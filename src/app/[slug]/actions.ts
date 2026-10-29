'use server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { clientIp, getCurrentUser } from '@/lib/auth/session';
import { normalizePhone } from '@/lib/domain/phone';
import { hhmmToMinute, isValidDate, todayIn } from '@/lib/domain/time';
import { rateLimit } from '@/lib/rate-limit';
import { createAppointment } from '@/server/booking';
import { findOrCreateClient } from '@/server/clients';
import { getPublicShop } from '@/server/public-shop';

const bookingSchema = z.object({
  slug: z.string(),
  serviceIds: z.array(z.string()).min(1).max(5),
  professionalId: z.string(),
  date: z.string(),
  time: z.string(),
  name: z.string().trim().min(2, 'Informe seu nome.').max(80),
  phone: z.string().trim().min(8, 'Informe seu WhatsApp.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').or(z.literal('')).optional(),
  notes: z.string().trim().max(300).optional(),
  referralCode: z.string().trim().max(12).optional(),
});

export type BookingResult = { ok: true; token: string; status: 'PENDING' | 'CONFIRMED' } | { ok: false; error: string };

export async function bookAction(raw: z.input<typeof bookingSchema>): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!rateLimit(`book:${await clientIp()}`, 20, 60 * 60_000)) return { ok: false, error: 'Muitas reservas deste aparelho. Tente mais tarde ou fale com a loja.' };
  const phone = normalizePhone(d.phone);
  if (!phone) return { ok: false, error: 'WhatsApp inválido. Use DDD + número.' };
  const minute = hhmmToMinute(d.time);
  if (minute === null || !isValidDate(d.date)) return { ok: false, error: 'Horário inválido.' };
  const shop = await getPublicShop(d.slug);
  if (!shop) return { ok: false, error: 'Loja não encontrada.' };
  const user = await getCurrentUser();
  const r = await createAppointment({
    shopId: shop.id,
    professionalId: d.professionalId,
    serviceIds: d.serviceIds,
    date: d.date,
    startMinute: minute,
    client: { name: d.name, phone, email: d.email || user?.email || null, userId: user?.id ?? null, referralCode: d.referralCode || null },
    notes: d.notes,
    source: 'ONLINE',
  });
  if (!r.ok) return r;
  const appt = await db.appointment.findUnique({ where: { id: r.appointmentId }, select: { status: true } });
  return { ok: true, token: r.publicToken, status: appt?.status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING' };
}

const waitSchema = z.object({
  slug: z.string(),
  date: z.string(),
  professionalId: z.string(),
  serviceIds: z.array(z.string()).max(5),
  name: z.string().trim().min(2, 'Informe seu nome.').max(80),
  phone: z.string().trim().min(8, 'Informe seu WhatsApp.'),
});

export async function joinWaitlistAction(raw: z.input<typeof waitSchema>): Promise<{ ok: true; ahead: number } | { ok: false; error: string }> {
  const parsed = waitSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!rateLimit(`wait:${await clientIp()}`, 10, 60 * 60_000)) return { ok: false, error: 'Muitas tentativas. Tente mais tarde.' };
  const phone = normalizePhone(d.phone);
  if (!phone) return { ok: false, error: 'WhatsApp inválido. Use DDD + número.' };
  const shop = await getPublicShop(d.slug);
  if (!shop || !shop.plan.active) return { ok: false, error: 'Loja indisponível.' };
  if (!isValidDate(d.date) || d.date < todayIn(shop.timezone)) return { ok: false, error: 'Data inválida.' };
  const professionalId = d.professionalId !== 'any' && shop.memberships.some((m) => m.id === d.professionalId) ? d.professionalId : null;
  const user = await getCurrentUser();
  const result = await db.$transaction(async (tx) => {
    const client = await findOrCreateClient(tx, shop.id, { name: d.name, phone, userId: user?.id ?? null });
    const already = await tx.waitlistEntry.findFirst({ where: { shopId: shop.id, clientId: client.id, date: d.date, status: 'WAITING' } });
    const entry = already ?? (await tx.waitlistEntry.create({ data: { shopId: shop.id, clientId: client.id, date: d.date, professionalId, serviceIds: d.serviceIds.filter((id) => shop.services.some((s) => s.id === id)) } }));
    const ahead = await tx.waitlistEntry.count({ where: { shopId: shop.id, date: d.date, status: 'WAITING', createdAt: { lt: entry.createdAt } } });
    return ahead;
  });
  return { ok: true, ahead: result };
}
