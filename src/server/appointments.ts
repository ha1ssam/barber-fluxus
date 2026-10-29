import 'server-only';
import { db } from '@/lib/db';
import { canTransition, type AppointmentStatus } from '@/lib/domain/appointment-status';
import { checkSlot } from '@/lib/domain/availability';
import { planReminders } from '@/lib/domain/reminders';
import { utcToZoned, zonedToUtc } from '@/lib/domain/time';
import { buildInput } from './availability';
import { cancelAppointmentMessages, enqueueAppointmentMessage, notifyWaitlist } from './messages';
import { notifyShopStaff } from './push';

async function planAppointmentReminders(appointmentId: string, now: Date) {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, include: { shop: true } });
  if (!appt) return;
  const [reminder, eve] = await Promise.all([
    db.messageTemplate.findUnique({ where: { shopId_kind: { shopId: appt.shopId, kind: 'REMINDER' } } }),
    db.messageTemplate.findUnique({ where: { shopId_kind: { shopId: appt.shopId, kind: 'REMINDER_EVE' } } }),
  ]);
  const plan = planReminders(
    appt.startsAt,
    appt.shop.timezone,
    {
      reminderEnabled: reminder?.enabled ?? true,
      hoursBefore: appt.shop.reminderHoursBefore,
      eveEnabled: eve?.enabled ?? true,
      eveHour: appt.shop.reminderEveHour,
    },
    now,
  );
  for (const r of plan) await enqueueAppointmentMessage(appt.id, r.kind, r.sendAt);
}

/** Efeitos de um agendamento novo: mensagem ao cliente, lembretes e aviso para a equipe. */
export async function onAppointmentCreated(appointmentId: string, now = new Date()) {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, include: { client: true, shop: true } });
  if (!appt) return;
  await enqueueAppointmentMessage(appt.id, appt.status === 'CONFIRMED' ? 'CONFIRMATION' : 'BOOKING_RECEIVED', now);
  await planAppointmentReminders(appt.id, now);
  if (appt.source !== 'MANUAL') {
    const when = utcToZoned(appt.startsAt, appt.shop.timezone);
    await notifyShopStaff(appt.shopId, appt.professionalId, {
      title: appt.status === 'PENDING' ? 'Nova reserva para confirmar' : 'Nova reserva',
      body: `${appt.client.name} · ${when.date.split('-').reverse().slice(0, 2).join('/')} às ${String(Math.floor(when.minute / 60)).padStart(2, '0')}:${String(when.minute % 60).padStart(2, '0')}`,
      url: '/painel/agendamentos',
    });
  }
}

export interface StatusActor {
  /** true quando quem muda é o próprio cliente (link ou WhatsApp) */
  byClient?: boolean;
}

/** Muda o status (exceto concluir, que passa pelo caixa) e dispara os efeitos. */
export async function changeStatus(
  appointmentId: string,
  to: Exclude<AppointmentStatus, 'COMPLETED'>,
  actor: StatusActor = {},
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) return { ok: false, error: 'Agendamento não encontrado.' };
  const check = canTransition(appt.status, to, { endsAt: appt.endsAt, now });
  if (!check.ok) return check;

  const updated = await db.appointment.updateMany({
    where: { id: appt.id, status: appt.status },
    data: {
      status: to,
      confirmedAt: to === 'CONFIRMED' ? now : undefined,
      cancelledAt: to === 'CANCELLED' ? now : undefined,
      cancelledByClient: to === 'CANCELLED' ? !!actor.byClient : undefined,
    },
  });
  if (updated.count === 0) return { ok: false, error: 'O agendamento mudou enquanto você editava. Atualize a página.' };

  if (to === 'CONFIRMED') {
    await enqueueAppointmentMessage(appt.id, 'CONFIRMATION', now);
  } else if (to === 'CANCELLED') {
    await cancelAppointmentMessages(appt.id);
    if (!actor.byClient) await enqueueAppointmentMessage(appt.id, 'CANCELLATION', now);
    else {
      const client = await db.client.findUnique({ where: { id: appt.clientId } });
      await notifyShopStaff(appt.shopId, appt.professionalId, {
        title: 'Horário cancelado pelo cliente',
        body: `${client?.name ?? 'Cliente'} cancelou o horário.`,
        url: '/painel/agendamentos',
      });
    }
    await notifyWaitlist(appt.shopId, appt.startsAt, appt.professionalId, now);
  } else if (to === 'NO_SHOW') {
    await cancelAppointmentMessages(appt.id);
  }
  return { ok: true };
}

/** Remarca para outra data/hora (e opcionalmente outro profissional), revalidando o horário. */
export async function reschedule(
  appointmentId: string,
  target: { date: string; startMinute: number; professionalId?: string; allowOutsideHours?: boolean },
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, include: { shop: true } });
  if (!appt) return { ok: false, error: 'Agendamento não encontrado.' };
  if (appt.status !== 'PENDING' && appt.status !== 'CONFIRMED') return { ok: false, error: 'Só é possível remarcar agendamentos pendentes ou confirmados.' };
  const professionalId = target.professionalId ?? appt.professionalId;
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${professionalId}:${target.date}`}))`;
    const input = await buildInput(tx, appt.shop, professionalId, target.date, appt.totalDurationMinutes, {
      now,
      online: false,
      excludeAppointmentId: appt.id,
    });
    if (!input) return { ok: false as const, error: 'Data inválida.' };
    const check = checkSlot(input, target.startMinute, { allowOutsideHours: target.allowOutsideHours });
    if (!check.ok) return { ok: false as const, error: check.reason === 'conflict' ? 'Este horário já está ocupado.' : 'Este horário está fora do expediente.' };
    const startsAt = zonedToUtc(target.date, target.startMinute, appt.shop.timezone);
    await tx.appointment.update({
      where: { id: appt.id },
      data: { startsAt, endsAt: new Date(startsAt.getTime() + appt.totalDurationMinutes * 60_000), professionalId },
    });
    return { ok: true as const };
  });
  if (!result.ok) return result;
  await cancelAppointmentMessages(appt.id);
  await enqueueAppointmentMessage(appt.id, 'CONFIRMATION', now);
  await planAppointmentReminders(appt.id, now);
  await notifyWaitlist(appt.shopId, appt.startsAt, appt.professionalId, now);
  return { ok: true };
}
