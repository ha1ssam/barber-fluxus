import { db } from '@/lib/db';
import { formatBRL } from '@/lib/domain/money';
import { dayRangeUtc, formatDateBR, isValidDate, minuteToHHMM, todayIn, utcToZoned, weekdayLong, weekdayOf } from '@/lib/domain/time';
import { Page } from '@/components/dashboard/Topbar';
import { EmptyState } from '@/components/ui/basic';
import { canMember, requireMember, resolveProfessional } from '@/server/context';
import { scheduleOptions } from '@/server/schedule-options';
import { AgendaView, type AgendaRow } from './view';

export const metadata = { title: 'Agenda' };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ data?: string; profissional?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember('agenda.own');
  const tz = ctx.shop.timezone;
  const today = todayIn(tz);
  const date = sp.data && isValidDate(sp.data) ? sp.data : today;
  const professionalId = await resolveProfessional(ctx, sp.profissional);
  const options = await scheduleOptions(ctx);
  if (!professionalId) {
    return (
      <Page title="Agenda" icon="calendar">
        <EmptyState icon="user-plus" title="Nenhum profissional atende na loja" text="Marque você ou alguém da equipe como profissional em Equipe." />
      </Page>
    );
  }
  const { start, end } = dayRangeUtc(date, tz);
  const [hours, appts, blocks] = await Promise.all([
    db.workingHours.findMany({ where: { membershipId: professionalId, weekday: weekdayOf(date) }, orderBy: { startMinute: 'asc' } }),
    db.appointment.findMany({
      where: { professionalId, startsAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
      include: { client: true, services: true },
      orderBy: { startsAt: 'asc' },
    }),
    db.timeBlock.findMany({ where: { professionalId, startsAt: { lt: end }, endsAt: { gt: start } } }),
  ]);

  const step = ctx.shop.slotInterval;
  const shifts = hours.map((h) => ({ start: h.startMinute, end: h.endMinute }));
  const apptLocal = appts.map((a) => {
    const s = utcToZoned(a.startsAt, tz).minute;
    return { a, start: s, end: s + a.totalDurationMinutes };
  });
  const blockLocal = blocks.map((b) => {
    const s = utcToZoned(b.startsAt, tz);
    const e = utcToZoned(b.endsAt, tz);
    return { b, start: s.date < date ? 0 : s.minute, end: e.date > date ? 24 * 60 : e.minute };
  });
  const minStart = Math.min(8 * 60, ...shifts.map((s) => s.start), ...apptLocal.map((x) => x.start));
  const maxEnd = Math.max(20 * 60, ...shifts.map((s) => s.end), ...apptLocal.map((x) => x.end));
  const first = Math.floor(minStart / step) * step;
  const now = new Date();
  const nowMinute = utcToZoned(now, tz).minute;

  const rows: AgendaRow[] = [];
  const shown = new Set<string>();
  for (let t = first; t < maxEnd; t += step) {
    const rowEnd = t + step;
    const appt = apptLocal.find((x) => x.start < rowEnd && x.end > t);
    if (appt) {
      const firstRow = !shown.has(appt.a.id);
      shown.add(appt.a.id);
      rows.push({
        time: minuteToHHMM(t),
        kind: 'appointment',
        appointment: firstRow
          ? {
              id: appt.a.id,
              status: appt.a.status,
              clientName: appt.a.client.name,
              phone: appt.a.client.phone,
              services: appt.a.services.map((s) => s.name).join(' + '),
              price: formatBRL(appt.a.totalPriceCents),
              range: `${minuteToHHMM(appt.start)}–${minuteToHHMM(appt.end)}`,
              ended: appt.a.endsAt <= now,
              durationMinutes: appt.a.totalDurationMinutes,
              notes: appt.a.notes,
            }
          : null,
      });
      continue;
    }
    const block = blockLocal.find((x) => x.start < rowEnd && x.end > t);
    if (block) {
      rows.push({ time: minuteToHHMM(t), kind: 'blocked', label: block.b.reason || 'Bloqueado', blockId: block.b.id });
      continue;
    }
    const inShift = shifts.some((s) => t >= s.start && rowEnd <= s.end);
    const betweenShifts = !inShift && shifts.some((s) => s.end <= t) && shifts.some((s) => s.start >= rowEnd);
    const past = date < today || (date === today && t < nowMinute);
    rows.push({ time: minuteToHHMM(t), kind: inShift ? (past ? 'past' : 'free') : betweenShifts ? 'lunch' : 'off' });
  }

  const summary = {
    booked: appts.filter((a) => a.status !== 'NO_SHOW').length,
    free: rows.filter((r) => r.kind === 'free').length,
    blocked: rows.filter((r) => r.kind === 'blocked').length,
  };

  return (
    <Page title="Agenda" icon="calendar" badge={`${weekdayLong(date)}, ${formatDateBR(date)}`}>
      <AgendaView
        date={date}
        today={today}
        professionalId={professionalId}
        canSwitch={canMember(ctx, 'agenda.all')}
        canBlock={canMember(ctx, 'agenda.all') || ctx.membership.canManageOwnSchedule}
        options={options}
        rows={rows}
        summary={summary}
        dayOff={shifts.length === 0}
      />
    </Page>
  );
}
