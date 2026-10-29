import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { formatBRL } from '@/lib/domain/money';
import { formatPhone } from '@/lib/domain/phone';
import { addDays, formatDateBR, isValidDate, minuteToHHMM, todayIn, utcToZoned, zonedToUtc } from '@/lib/domain/time';
import { Page } from '@/components/dashboard/Topbar';
import { EmptyState, StatusBadge } from '@/components/ui/basic';
import { AppointmentActions } from '@/components/appointments/AppointmentActions';
import { NewBookingButton } from '@/components/appointments/NewBookingButton';
import { AppointmentFilters } from './filters';
import { canMember, memberName, requireMember } from '@/server/context';
import { scheduleOptions } from '@/server/schedule-options';

export const metadata = { title: 'Agendamentos' };

const PERIODS: Record<string, [number, number]> = { manha: [0, 12 * 60], tarde: [12 * 60, 18 * 60], noite: [18 * 60, 24 * 60] };

export default async function Page_({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireMember('agenda.own');
  const tz = ctx.shop.timezone;
  const today = todayIn(tz);
  const from = sp.de && isValidDate(sp.de) ? sp.de : today;
  const to = sp.ate && isValidDate(sp.ate) ? sp.ate : addDays(from, 30);
  const status = sp.status && ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(sp.status) ? sp.status : undefined;
  const all = canMember(ctx, 'agenda.all');
  const options = await scheduleOptions(ctx);
  const pro = all ? (sp.profissional && options.professionals.some((p) => p.id === sp.profissional) ? sp.profissional : undefined) : ctx.membership.id;
  const order = sp.ordem === 'cliente' ? [{ client: { name: 'asc' as const } }] : sp.ordem === 'recentes' ? [{ createdAt: 'desc' as const }] : [{ startsAt: 'asc' as const }];

  const where: Prisma.AppointmentWhereInput = {
    shopId: ctx.shop.id,
    startsAt: { gte: zonedToUtc(from, 0, tz), lt: zonedToUtc(addDays(to, 1), 0, tz) },
    ...(status ? { status: status as 'PENDING' } : {}),
    ...(pro ? { professionalId: pro } : {}),
  };
  let appts = await db.appointment.findMany({
    where,
    include: { client: true, services: true, professional: { include: { user: { select: { name: true } } } } },
    orderBy: order,
    take: 300,
  });
  const period = sp.periodo ? PERIODS[sp.periodo] : undefined;
  if (period) appts = appts.filter((a) => {
    const m = utcToZoned(a.startsAt, tz).minute;
    return m >= period[0] && m < period[1];
  });
  if (sp.ordem === 'servico') appts.sort((a, b) => (a.services[0]?.name ?? '').localeCompare(b.services[0]?.name ?? ''));
  const now = new Date();

  return (
    <Page title="Agendamentos" icon="calendar-check" badge={`${appts.length}`} actions={<NewBookingButton options={options} defaultProfessionalId={pro ?? options.professionals[0]?.id ?? ''} defaultDate={today} />}>
      <AppointmentFilters
        values={{ de: from, ate: to, status: status ?? '', periodo: sp.periodo ?? '', ordem: sp.ordem ?? 'data', profissional: pro ?? '' }}
        professionals={all ? options.professionals.map((p) => ({ value: p.id, label: p.name })) : []}
      />
      {appts.length === 0 ? (
        <EmptyState icon="calendar-check" title="Nenhum agendamento nesse filtro" text="Mude o período ou o status para ver outros agendamentos." />
      ) : (
        <div className="table-wrap">
          <table className="fx-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Serviços</th>
                {all && options.professionals.length > 1 ? <th>Profissional</th> : null}
                <th className="num">Valor</th>
                <th>Status</th>
                <th className="num">Ações</th>
              </tr>
            </thead>
            <tbody>
              {appts.map((a) => {
                const z = utcToZoned(a.startsAt, tz);
                return (
                  <tr key={a.id}>
                    <td className="nowrap">
                      <div className="strong">{formatDateBR(z.date).slice(0, 5)} · {minuteToHHMM(z.minute)}</div>
                      <div className="muted xs">{a.source === 'MANUAL' ? 'Manual' : a.source === 'WHATSAPP' ? 'WhatsApp' : 'Online'}</div>
                    </td>
                    <td>
                      <Link href={`/painel/clientes/${a.clientId}`} className="strong" style={{ color: 'var(--text)', textDecoration: 'none' }}>
                        {a.client.name}
                      </Link>
                      <div className="muted xs">{formatPhone(a.client.phone)}</div>
                    </td>
                    <td>
                      {a.services.map((s) => s.name).join(' + ')}
                      {a.notes ? <div className="muted xs">“{a.notes}”</div> : null}
                    </td>
                    {all && options.professionals.length > 1 ? <td>{memberName(a.professional)}</td> : null}
                    <td className="num nowrap">{formatBRL(a.totalPriceCents)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      <AppointmentActions
                        options={options}
                        appt={{ id: a.id, status: a.status, ended: a.endsAt <= now, professionalId: a.professionalId, date: z.date, time: minuteToHHMM(z.minute), durationMinutes: a.totalDurationMinutes, clientName: a.client.name }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
