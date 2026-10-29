import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from '@/lib/db';
import { availableSlots, checkSlot, type AvailabilityInput, type Interval } from '@/lib/domain/availability';
import { addDays, dayRangeUtc, todayIn, utcToZoned, weekdayOf } from '@/lib/domain/time';

type Tx = PrismaClient | Prisma.TransactionClient;

export interface ShopAgendaConfig {
  id: string;
  timezone: string;
  slotInterval: number;
  bufferMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
}

function toLocalInterval(startsAt: Date, endsAt: Date, date: string, tz: string): Interval {
  const s = utcToZoned(startsAt, tz);
  const e = utcToZoned(endsAt, tz);
  return {
    start: s.date < date ? 0 : s.minute,
    end: e.date > date ? 24 * 60 : e.minute,
  };
}

/** Busca expediente, agendamentos e bloqueios de um profissional num dia. */
export async function loadDay(tx: Tx, shop: ShopAgendaConfig, professionalId: string, date: string, excludeAppointmentId?: string) {
  const { start, end } = dayRangeUtc(date, shop.timezone);
  const [hours, appts, blocks] = await Promise.all([
    tx.workingHours.findMany({ where: { membershipId: professionalId, weekday: weekdayOf(date) } }),
    tx.appointment.findMany({
      where: {
        professionalId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { lt: end },
        endsAt: { gt: start },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { startsAt: true, endsAt: true },
    }),
    tx.timeBlock.findMany({ where: { professionalId, startsAt: { lt: end }, endsAt: { gt: start } }, select: { startsAt: true, endsAt: true } }),
  ]);
  return {
    shifts: hours.map((h) => ({ start: h.startMinute, end: h.endMinute })),
    appointments: appts.map((a) => toLocalInterval(a.startsAt, a.endsAt, date, shop.timezone)),
    blocks: blocks.map((b) => toLocalInterval(b.startsAt, b.endsAt, date, shop.timezone)),
  };
}

/** Regras de antecedência da reserva online. Retorna null se o dia não aceita reservas. */
export function onlineWindow(shop: ShopAgendaConfig, date: string, now: Date): { notBeforeMinute?: number } | null {
  const today = todayIn(shop.timezone, now);
  if (date < today) return null;
  if (date > addDays(today, shop.maxAdvanceDays)) return null;
  const earliest = new Date(now.getTime() + shop.minAdvanceMinutes * 60_000);
  const e = utcToZoned(earliest, shop.timezone);
  if (e.date > date) return null;
  if (e.date === date) return { notBeforeMinute: e.minute };
  return {};
}

export async function buildInput(
  tx: Tx,
  shop: ShopAgendaConfig,
  professionalId: string,
  date: string,
  durationMinutes: number,
  opts: { now: Date; online: boolean; excludeAppointmentId?: string },
): Promise<AvailabilityInput | null> {
  let notBeforeMinute: number | undefined;
  if (opts.online) {
    const w = onlineWindow(shop, date, opts.now);
    if (!w) return null;
    notBeforeMinute = w.notBeforeMinute;
  }
  const day = await loadDay(tx, shop, professionalId, date, opts.excludeAppointmentId);
  return { ...day, durationMinutes, slotInterval: shop.slotInterval, bufferMinutes: shop.bufferMinutes, notBeforeMinute };
}

export async function slotsFor(shop: ShopAgendaConfig, professionalId: string, date: string, durationMinutes: number, now = new Date()) {
  const input = await buildInput(db, shop, professionalId, date, durationMinutes, { now, online: true });
  return input ? availableSlots(input) : [];
}

/** Profissionais ativos que fazem todos os serviços escolhidos. */
export async function professionalsForServices(shopId: string, serviceIds: string[]) {
  const pros = await db.membership.findMany({
    where: { shopId, active: true, isProfessional: true },
    include: { services: { select: { serviceId: true } }, user: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return pros.filter((p) => serviceIds.every((id) => p.services.some((s) => s.serviceId === id)));
}

export { checkSlot };
