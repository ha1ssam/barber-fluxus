import { db } from '@/lib/db';
import { formatDateBR, minuteToHHMM, todayIn, utcToZoned, zonedToUtc } from '@/lib/domain/time';
import { Page } from '@/components/dashboard/Topbar';
import { EmptyState } from '@/components/ui/basic';
import { canMember, memberName, requireMember } from '@/server/context';
import { scheduleOptions } from '@/server/schedule-options';
import { BlocksClient } from './client';

export const metadata = { title: 'Bloqueios' };

export default async function BlocksPage() {
  const ctx = await requireMember('agenda.own');
  const all = canMember(ctx, 'agenda.all');
  const tz = ctx.shop.timezone;
  const today = todayIn(tz);
  const options = await scheduleOptions(ctx);
  const blocks = await db.timeBlock.findMany({
    where: { shopId: ctx.shop.id, endsAt: { gte: zonedToUtc(today, 0, tz) }, ...(all ? {} : { professionalId: ctx.membership.id }) },
    include: { professional: { include: { user: { select: { name: true } } } } },
    orderBy: { startsAt: 'asc' },
  });
  const rows = blocks.map((b) => {
    const s = utcToZoned(b.startsAt, tz);
    const e = utcToZoned(b.endsAt, tz);
    const allDay = s.minute === 0 && (e.minute === 0 || e.date > s.date);
    return {
      id: b.id,
      date: formatDateBR(s.date),
      range: allDay ? 'Dia todo' : `${minuteToHHMM(s.minute)}–${e.date > s.date ? '24:00' : minuteToHHMM(e.minute)}`,
      reason: b.reason ?? '—',
      professional: memberName(b.professional),
    };
  });
  const canEdit = all || ctx.membership.canManageOwnSchedule;
  return (
    <Page title="Bloqueios" icon="calendar-x" badge={`${rows.length}`}>
      <BlocksClient options={options} rows={rows} canEdit={canEdit} canClear={all} showProfessional={all && options.professionals.length > 1} />
      {rows.length === 0 ? <EmptyState icon="calendar-x" title="Nenhum bloqueio futuro" text="Bloqueie folgas, consultas e cursos para eles sumirem da agenda online." /> : null}
    </Page>
  );
}
