'use server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { availableSlots } from '@/lib/domain/availability';
import { hasReward } from '@/lib/domain/loyalty';
import { normalizePhone } from '@/lib/domain/phone';
import { hhmmToMinute, isValidDate } from '@/lib/domain/time';
import { changeStatus, reschedule } from '@/server/appointments';
import { buildInput } from '@/server/availability';
import { createAppointment } from '@/server/booking';
import { ActionError, canMember, memberForAction, runAction, type ActionResult } from '@/server/context';
import { checkout } from '@/server/finance';

type Ctx = Awaited<ReturnType<typeof memberForAction>>;

async function operable(ctx: Ctx, appointmentId: string) {
  const appt = await db.appointment.findFirst({ where: { id: appointmentId, shopId: ctx.shop.id } });
  if (!appt) throw new ActionError('Agendamento não encontrado.');
  if (!canMember(ctx, 'agenda.all') && appt.professionalId !== ctx.membership.id) throw new ActionError('Você só pode mexer na sua própria agenda.');
  return appt;
}

function assertProfessional(ctx: Ctx, professionalId: string) {
  if (!canMember(ctx, 'agenda.all') && professionalId !== ctx.membership.id) throw new ActionError('Você só pode mexer na sua própria agenda.');
}

export async function setStatusAction(appointmentId: string, status: 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW'): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('agenda.own');
    await operable(ctx, appointmentId);
    const r = await changeStatus(appointmentId, status);
    if (!r.ok) throw new ActionError(r.error);
    const msg = { CONFIRMED: 'Agendamento confirmado.', CANCELLED: 'Agendamento cancelado.', NO_SHOW: 'Falta registrada.' }[status];
    return { ok: true, message: msg };
  });
}

export async function slotsAction(professionalId: string, date: string, durationMinutes: number, excludeAppointmentId?: string): Promise<ActionResult<number[]>> {
  return runAction(async () => {
    const ctx = await memberForAction('agenda.own');
    assertProfessional(ctx, professionalId);
    if (!isValidDate(date) || durationMinutes <= 0) return { ok: true, data: [] };
    const input = await buildInput(db, ctx.shop, professionalId, date, durationMinutes, { now: new Date(), online: false, excludeAppointmentId });
    return { ok: true, data: input ? availableSlots(input) : [] };
  });
}

export async function rescheduleAction(input: { appointmentId: string; date: string; time: string; professionalId: string; allowOutsideHours: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('agenda.own');
    await operable(ctx, input.appointmentId);
    assertProfessional(ctx, input.professionalId);
    const minute = hhmmToMinute(input.time);
    if (minute === null || !isValidDate(input.date)) throw new ActionError('Data ou horário inválido.');
    const r = await reschedule(input.appointmentId, { date: input.date, startMinute: minute, professionalId: input.professionalId, allowOutsideHours: input.allowOutsideHours });
    if (!r.ok) throw new ActionError(r.error);
    return { ok: true, message: 'Agendamento remarcado.' };
  });
}

const manualSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.'),
  phone: z.string().trim().min(8, 'Informe o telefone do cliente.'),
  serviceIds: z.array(z.string()).min(1, 'Escolha pelo menos um serviço.'),
  professionalId: z.string().min(1),
  date: z.string(),
  time: z.string(),
  notes: z.string().optional(),
  allowOutsideHours: z.boolean().default(false),
});

export async function createManualAction(raw: z.input<typeof manualSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('agenda.own');
    const parsed = manualSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const d = parsed.data;
    assertProfessional(ctx, d.professionalId);
    const phone = normalizePhone(d.phone);
    if (!phone) throw new ActionError('Telefone inválido. Use DDD + número.');
    const minute = hhmmToMinute(d.time);
    if (minute === null) throw new ActionError('Horário inválido.');
    const r = await createAppointment({
      shopId: ctx.shop.id,
      professionalId: d.professionalId,
      serviceIds: d.serviceIds,
      date: d.date,
      startMinute: minute,
      client: { name: d.name, phone },
      notes: d.notes,
      source: 'MANUAL',
      createdById: ctx.user.id,
      allowOutsideHours: d.allowOutsideHours,
    });
    if (!r.ok) throw new ActionError(r.error);
    return { ok: true, message: 'Agendamento criado.' };
  });
}

export async function searchClientsAction(q: string): Promise<ActionResult<{ id: string; name: string; phone: string }[]>> {
  return runAction(async () => {
    const ctx = await memberForAction('clients');
    const term = q.trim();
    if (term.length < 2) return { ok: true, data: [] };
    const digits = term.replace(/\D/g, '');
    const clients = await db.client.findMany({
      where: { shopId: ctx.shop.id, OR: [{ name: { contains: term, mode: 'insensitive' } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] },
      select: { id: true, name: true, phone: true },
      take: 8,
      orderBy: { name: 'asc' },
    });
    return { ok: true, data: clients };
  });
}

export interface CheckoutInfo {
  appointment: { id: string; clientName: string; services: { name: string; priceCents: number }[] } | null;
  products: { id: string; name: string; priceCents: number }[];
  client: { id: string; name: string; stamps: number; hasReward: boolean } | null;
  loyalty: { enabled: boolean; required: number; reward: string };
}

export async function checkoutInfoAction(appointmentId: string | null): Promise<ActionResult<CheckoutInfo>> {
  return runAction(async () => {
    const ctx = await memberForAction('agenda.own');
    const appt = appointmentId ? await operable(ctx, appointmentId) : null;
    const full = appt ? await db.appointment.findUnique({ where: { id: appt.id }, include: { services: true, client: true } }) : null;
    const products = await db.product.findMany({ where: { shopId: ctx.shop.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, priceCents: true } });
    const cfg = { enabled: ctx.shop.loyaltyEnabled, stampsRequired: ctx.shop.loyaltyStampsRequired };
    return {
      ok: true,
      data: {
        appointment: full ? { id: full.id, clientName: full.client.name, services: full.services.map((s) => ({ name: s.name, priceCents: s.priceCents })) } : null,
        products,
        client: full ? { id: full.client.id, name: full.client.name, stamps: full.client.stamps, hasReward: hasReward(full.client.stamps, cfg) } : null,
        loyalty: { enabled: ctx.shop.loyaltyEnabled, required: ctx.shop.loyaltyStampsRequired, reward: ctx.shop.loyaltyReward },
      },
    };
  });
}

const checkoutSchema = z.object({
  appointmentId: z.string().nullable(),
  clientId: z.string().nullable().optional(),
  products: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(99) })),
  paymentMethod: z.enum(['CASH', 'PIX', 'CREDIT', 'DEBIT', 'OTHER']),
  couponCode: z.string().optional(),
  redeemReward: z.boolean().optional(),
});

export async function checkoutAction(raw: z.input<typeof checkoutSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = checkoutSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError('Confira os itens da venda.');
    const d = parsed.data;
    const ctx = await memberForAction(d.appointmentId ? 'agenda.own' : 'cash');
    if (d.appointmentId) await operable(ctx, d.appointmentId);
    const r = await checkout({
      shopId: ctx.shop.id,
      userId: ctx.user.id,
      appointmentId: d.appointmentId ?? undefined,
      clientId: d.clientId ?? null,
      professionalId: d.appointmentId ? undefined : ctx.membership.isProfessional ? ctx.membership.id : null,
      products: d.products,
      paymentMethod: d.paymentMethod,
      couponCode: d.couponCode,
      redeemReward: d.redeemReward,
    });
    if (!r.ok) throw new ActionError(r.error);
    return { ok: true, message: d.appointmentId ? 'Atendimento concluído.' : 'Venda registrada.' };
  });
}
