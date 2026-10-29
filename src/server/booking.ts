import 'server-only';
import { db } from '@/lib/db';
import { randomToken } from '@/lib/crypto';
import { checkSlot, sumServices } from '@/lib/domain/availability';
import { planState } from '@/lib/domain/plans';
import { isValidDate, todayIn, zonedToUtc } from '@/lib/domain/time';
import { buildInput } from './availability';
import { findOrCreateClient, type ClientInput } from './clients';
import { onAppointmentCreated } from './appointments';

export interface CreateAppointmentInput {
  shopId: string;
  /** id do profissional ou "any" (primeiro livre) */
  professionalId: string;
  serviceIds: string[];
  date: string;
  startMinute: number;
  client: ClientInput;
  notes?: string | null;
  source: 'ONLINE' | 'WHATSAPP' | 'MANUAL';
  createdById?: string | null;
  /** encaixe manual fora da grade ou do expediente */
  allowOutsideHours?: boolean;
  now?: Date;
}

export type CreateAppointmentResult = { ok: true; appointmentId: string; publicToken: string } | { ok: false; error: string };

const REJECTIONS: Record<string, string> = {
  outside_hours: 'Este horário está fora do expediente.',
  conflict: 'Este horário já está ocupado.',
  too_soon: 'Este horário não está mais disponível.',
  invalid: 'Horário inválido.',
};

/**
 * Cria um agendamento validando tudo no servidor (serviços, profissional, expediente, conflitos, antecedência).
 * Uma trava por profissional e dia (advisory lock do Postgres) impede duas reservas no mesmo horário.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
  const now = input.now ?? new Date();
  const manual = input.source === 'MANUAL';
  const shop = await db.shop.findUnique({ where: { id: input.shopId }, include: { subscription: true } });
  if (!shop) return { ok: false, error: 'Loja não encontrada.' };
  if (!planState(shop.subscription, now).active) {
    return { ok: false, error: manual ? 'Sua assinatura está inativa. Renove para agendar.' : 'Esta loja não está aceitando reservas no momento.' };
  }
  if (!isValidDate(input.date)) return { ok: false, error: 'Data inválida.' };
  if (!manual && input.date < todayIn(shop.timezone, now)) return { ok: false, error: 'Escolha uma data a partir de hoje.' };

  const serviceIds = [...new Set(input.serviceIds)];
  if (serviceIds.length === 0) return { ok: false, error: 'Escolha pelo menos um serviço.' };
  const services = await db.service.findMany({ where: { id: { in: serviceIds }, shopId: shop.id, active: true } });
  if (services.length !== serviceIds.length) return { ok: false, error: 'Algum serviço escolhido não está mais disponível.' };
  const ordered = serviceIds.map((id) => services.find((s) => s.id === id)!);
  const totals = sumServices(ordered);

  const pros = await db.membership.findMany({
    where: { shopId: shop.id, active: true, isProfessional: true },
    include: { services: { select: { serviceId: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const able = pros.filter((p) => serviceIds.every((id) => p.services.some((s) => s.serviceId === id)));
  const candidates = input.professionalId === 'any' ? able : able.filter((p) => p.id === input.professionalId);
  if (candidates.length === 0) {
    const exists = pros.some((p) => p.id === input.professionalId);
    return { ok: false, error: exists ? 'Este profissional não faz todos os serviços escolhidos.' : 'Profissional não encontrado.' };
  }

  const startsAt = zonedToUtc(input.date, input.startMinute, shop.timezone);
  const endsAt = new Date(startsAt.getTime() + totals.durationMinutes * 60_000);

  const result = await db.$transaction(async (tx) => {
    let lastReason = 'conflict';
    for (const pro of candidates) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${pro.id}:${input.date}`}))`;
      const avail = await buildInput(tx, shop, pro.id, input.date, totals.durationMinutes, { now, online: !manual });
      if (!avail) {
        lastReason = 'too_soon';
        continue;
      }
      const check = checkSlot(avail, input.startMinute, { allowOutsideHours: manual && input.allowOutsideHours });
      if (!check.ok) {
        lastReason = check.reason;
        continue;
      }
      const client = await findOrCreateClient(tx, shop.id, input.client);
      const status = manual || shop.autoConfirm ? 'CONFIRMED' : 'PENDING';
      const appt = await tx.appointment.create({
        data: {
          shopId: shop.id,
          professionalId: pro.id,
          clientId: client.id,
          startsAt,
          endsAt,
          status,
          confirmedAt: status === 'CONFIRMED' ? now : null,
          source: input.source,
          totalPriceCents: totals.priceCents,
          totalDurationMinutes: totals.durationMinutes,
          notes: input.notes?.trim() || null,
          publicToken: randomToken(18),
          createdById: input.createdById ?? null,
          services: {
            create: ordered.map((s) => ({ serviceId: s.id, name: s.name, priceCents: s.priceCents, durationMinutes: s.durationMinutes })),
          },
        },
      });
      // Se o cliente estava na fila desse dia, sai da fila.
      await tx.waitlistEntry.updateMany({ where: { shopId: shop.id, clientId: client.id, date: input.date, status: { in: ['WAITING', 'NOTIFIED'] } }, data: { status: 'BOOKED' } });
      return { ok: true as const, appointmentId: appt.id, publicToken: appt.publicToken };
    }
    return { ok: false as const, error: REJECTIONS[lastReason] ?? REJECTIONS.conflict };
  });

  if (result.ok) await onAppointmentCreated(result.appointmentId, now);
  return result;
}
