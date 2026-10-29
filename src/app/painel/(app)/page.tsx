import Link from 'next/link';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { formatBRL } from '@/lib/domain/money';
import { hasFeature } from '@/lib/domain/plans';
import { minuteToHHMM, todayIn, utcToZoned, weekdayLong, formatDateBR } from '@/lib/domain/time';
import { Page } from '@/components/dashboard/Topbar';
import { Card, EmptyState, KpiCard, Notice, StatusBadge, Stars, ButtonLink } from '@/components/ui/basic';
import { Icon } from '@/components/ui/Icon';
import { CopyButton } from '@/components/ui/interactive';
import { AppointmentActions } from '@/components/appointments/AppointmentActions';
import { canMember, memberName, requireMember } from '@/server/context';
import { scheduleOptions } from '@/server/schedule-options';
import { dashboardStats } from '@/server/stats';
import { isDevSimulation } from '@/server/whatsapp/provider';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ 'bem-vindo'?: string; aviso?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember();
  const all = canMember(ctx, 'agenda.all');
  const professionalId = all ? null : ctx.membership.id;
  const today = todayIn(ctx.shop.timezone);
  const now = new Date();
  const [stats, options, setup, wa] = await Promise.all([
    dashboardStats(ctx.shop, today, professionalId, now),
    scheduleOptions(ctx),
    Promise.all([
      db.service.count({ where: { shopId: ctx.shop.id, active: true } }),
      db.workingHours.count({ where: { membership: { shopId: ctx.shop.id } } }),
    ]),
    db.whatsAppConnection.findUnique({ where: { shopId: ctx.shop.id } }),
  ]);
  const link = `${env.appUrl}/${ctx.shop.slug}`;
  const [serviceCount, hoursCount] = setup;
  const checklist = [
    { done: serviceCount > 0, label: 'Cadastrar serviços', href: '/painel/servicos' },
    { done: hoursCount > 0, label: 'Definir horário de atendimento', href: '/painel/configuracoes?aba=horarios' },
    { done: !!ctx.shop.addressLine, label: 'Preencher endereço e fotos', href: '/painel/configuracoes' },
    { done: wa?.status === 'CONNECTED' || isDevSimulation(), label: 'Conectar o WhatsApp', href: '/painel/whatsapp' },
  ];
  const showChecklist = canMember(ctx, 'settings') && (sp['bem-vindo'] || checklist.some((c) => !c.done));
  const waConnected = wa?.status === 'CONNECTED';

  return (
    <Page title="Dashboard" icon="bar-chart-alt-2" badge={`${weekdayLong(today)}, ${formatDateBR(today)}`}>
      {sp.aviso === 'sem-permissao' ? <Notice type="error">Você não tem permissão para acessar aquela página.</Notice> : null}
      {showChecklist ? (
        <Card title={sp['bem-vindo'] ? `Bem-vindo, ${ctx.user.name.split(' ')[0]}! Vamos deixar tudo pronto` : 'Termine a configuração'}>
          <ul className="list-plain">
            {checklist.map((c) => (
              <li key={c.label} className="list-item">
                <Icon name={c.done ? 'check-circle' : 'chevron-right'} size={18} style={{ color: c.done ? 'var(--success-text)' : 'var(--text-secondary)' }} />
                <span className="grow" style={{ textDecoration: c.done ? 'line-through' : undefined, color: c.done ? 'var(--text-secondary)' : undefined }}>
                  {c.label}
                </span>
                {!c.done ? (
                  <Link className="btn btn-sm btn-ghost" href={c.href}>
                    Fazer agora
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="kpi-grid">
        <KpiCard label="Agendamentos hoje" value={stats.todayAppts.length} icon="calendar-check" color="var(--brand-text)" />
        <KpiCard label="Faturamento" sub="Hoje" value={formatBRL(stats.revToday)} icon="wallet" color="var(--success-text)" />
        <KpiCard label="Faturamento" sub="Semana" value={formatBRL(stats.revWeek)} icon="line-chart" color="var(--success-text)" />
        <KpiCard label="Faturamento" sub="Mês" value={formatBRL(stats.revMonth)} icon="dollar-circle" color="var(--success-text)" />
        <KpiCard label="Pendentes" sub="A confirmar" value={stats.pending} icon="time-five" color="var(--warning-text)" />
        <KpiCard label="Faltas" sub="No mês" value={stats.noShows} icon="user-x" color="var(--danger-text)" />
        <KpiCard label="Cancelamentos" sub="No mês" value={stats.cancels} icon="calendar-x" color="var(--danger-text)" />
        <KpiCard label="Clientes" sub="Total" value={stats.clients} icon="group" color="var(--brand-text)" />
      </div>

      <div className="grid-main-aside">
        <Card
          title="Agenda de hoje"
          actions={
            <Link className="btn btn-sm btn-ghost" href="/painel/agenda">
              Ver agenda
            </Link>
          }
        >
          {stats.todayAppts.length === 0 ? (
            <EmptyState icon="calendar" title="Nenhum agendamento hoje" text="Compartilhe seu link de agendamento para receber reservas." />
          ) : (
            <ul className="list-plain">
              {stats.todayAppts.map((a) => {
                const z = utcToZoned(a.startsAt, ctx.shop.timezone);
                return (
                  <li key={a.id} className="list-item appt-item">
                    <span className="time-pill">{minuteToHHMM(z.minute)}</span>
                    <div className="grow">
                      <div className="strong">{a.client.name}</div>
                      <div className="muted xs">
                        {a.services.map((s) => s.name).join(' + ')} · {formatBRL(a.totalPriceCents)}
                        {all && options.professionals.length > 1 ? ` · ${memberName(a.professional)}` : ''}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                    <div className="appt-actions">
                    <AppointmentActions
                      options={options}
                      appt={{
                        id: a.id,
                        status: a.status,
                        ended: a.endsAt <= now,
                        professionalId: a.professionalId,
                        date: z.date,
                        time: minuteToHHMM(z.minute),
                        durationMinutes: a.totalDurationMinutes,
                        clientName: a.client.name,
                      }}
                    />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="stack">
          <Card title="Link de agendamento">
            <div className="stack-sm">
              <div className="link-box">
                <Icon name="link-alt" size={16} />
                <span>{link.replace(/^https?:\/\//, '')}</span>
                <CopyButton text={link} />
              </div>
              <span className="field-hint">Divulgue na bio do Instagram, no status e no WhatsApp.</span>
              <ButtonLink href={`/${ctx.shop.slug}`} variant="ghost" size="sm" icon="show" target="_blank">
                Ver minha página
              </ButtonLink>
            </div>
          </Card>
          <Card title="WhatsApp">
            <div className="row-between">
              <span className={`chip ${waConnected ? 'success' : isDevSimulation() ? 'warning' : 'danger'}`}>
                <Icon name="whatsapp" size={12} />
                {waConnected ? 'Conectado' : isDevSimulation() ? 'Simulado (desenvolvimento)' : 'Desconectado'}
              </span>
              {canMember(ctx, 'whatsapp') ? (
                <Link className="btn btn-sm btn-ghost" href="/painel/whatsapp">
                  {waConnected ? 'Gerenciar' : 'Conectar'}
                </Link>
              ) : null}
            </div>
          </Card>
          <Card title="Próximos 7 dias">
            <span className="kpi-value">{stats.next7}</span> <span className="muted">agendamentos</span>
          </Card>
          {canMember(ctx, 'billing') ? (
          <Card title="Plano">
            <div className="stack-sm">
              <div className="row-between">
                <span className="strong">{ctx.plan.trialing ? `Teste (${ctx.plan.trialDaysLeft} dias)` : ctx.plan.plan.name}</span>
                <span className="muted xs">{stats.monthCount} agendamentos no mês</span>
              </div>
              <span className="muted xs">
                {ctx.plan.effectivePlan.maxProfessionals === 1 ? '1 profissional' : `Até ${ctx.plan.effectivePlan.maxProfessionals} profissionais`}
                {hasFeature(ctx.plan, 'reports') ? ' · relatórios' : ''}
              </span>
            </div>
          </Card>
          ) : null}
          <Card
            title="Avaliações"
            actions={
              canMember(ctx, 'settings') ? (
                <Link className="btn btn-sm btn-ghost" href="/painel/avaliacoes">
                  Ver todas
                </Link>
              ) : undefined
            }
          >
            {stats.ratingCount === 0 ? (
              <p className="muted sm-text">Nenhuma avaliação ainda. O pedido de avaliação sai pelo WhatsApp depois de cada atendimento concluído.</p>
            ) : (
              <div className="stack-sm">
                <div className="row">
                  <span className="kpi-value">{(stats.rating ?? 0).toFixed(1).replace('.', ',')}</span>
                  <Stars rating={stats.rating ?? 0} />
                  <span className="muted xs">({stats.ratingCount})</span>
                </div>
                {stats.reviews.map((r) => (
                  <div key={r.id} className="review-item">
                    <div className="row-between">
                      <span className="strong sm-text">{r.client.name}</span>
                      <Stars rating={r.rating} size={12} />
                    </div>
                    {r.comment ? <p className="muted sm-text">{r.comment}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
