import { formatBRL } from '@/lib/domain/money';
import { hasFeature } from '@/lib/domain/plans';
import { addDays, formatDateBR, todayIn } from '@/lib/domain/time';
import { FeatureLocked, Page } from '@/components/dashboard/Topbar';
import { Card, EmptyState, KpiCard } from '@/components/ui/basic';
import { requireMember } from '@/server/context';
import { reportData, type ReportPeriod } from '@/server/stats';
import { PeriodTabs } from './tabs';

export const metadata = { title: 'Relatórios' };

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function Delta({ cur, prev, invert, pct }: { cur: number; prev: number; invert?: boolean; pct?: boolean }) {
  if (prev === 0 && cur === 0) return <span className="delta muted">sem variação</span>;
  if (prev === 0) return <span className="delta up">novo</span>;
  const d = pct ? (cur - prev) * 100 : ((cur - prev) / prev) * 100;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={`delta ${d === 0 ? '' : good ? 'up' : 'down'}`}>
      {d > 0 ? '▲' : d < 0 ? '▼' : ''} {Math.abs(d).toFixed(0)}{pct ? ' p.p.' : '%'} vs. anterior
    </span>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember('reports');
  if (!hasFeature(ctx.plan, 'reports')) return <Page title="Relatórios" icon="line-chart"><FeatureLocked feature="Relatórios" reason={ctx.plan.active ? undefined : ctx.plan.reason} /></Page>;
  const period: ReportPeriod = sp.periodo === 'semana' ? 'week' : sp.periodo === 'ano' ? 'year' : 'month';
  const today = todayIn(ctx.shop.timezone);
  const r = await reportData(ctx.shop, period, today);
  const { current: c, previous: p } = r;
  const maxSeries = Math.max(1, ...r.series.map((s) => s.cents));
  const maxHour = Math.max(1, ...r.hours.map((h) => h.count));
  const maxTop = Math.max(1, ...r.topServices.map((t) => t.totalCents));
  const maxRank = Math.max(1, ...r.ranking.map((t) => t.totalCents));
  const label = (key: string) => (period === 'year' ? MONTHS[Number(key.slice(5, 7)) - 1] : key.slice(8, 10));

  return (
    <Page title="Relatórios" icon="line-chart" badge={`${formatDateBR(r.range.from)} a ${formatDateBR(addDays(r.range.to, -1))}`}>
      <PeriodTabs value={sp.periodo ?? 'mes'} />
      <div className="kpi-grid">
        {[
          { label: 'Faturamento', value: formatBRL(c.revenueCents), d: <Delta cur={c.revenueCents} prev={p.revenueCents} />, icon: 'wallet' as const, color: 'var(--success-text)' },
          { label: 'Ticket médio', value: formatBRL(c.ticketCents), d: <Delta cur={c.ticketCents} prev={p.ticketCents} />, icon: 'receipt' as const, color: 'var(--brand-text)' },
          { label: 'Atendimentos', value: c.completed, d: <Delta cur={c.completed} prev={p.completed} />, icon: 'check-circle' as const, color: 'var(--success-text)' },
          { label: 'Comparecimento', value: c.attendanceRate === null ? '—' : `${Math.round(c.attendanceRate * 100)}%`, d: <Delta cur={c.attendanceRate ?? 0} prev={p.attendanceRate ?? 0} pct />, icon: 'check-double' as const, color: 'var(--brand-text)' },
          { label: 'Cancelamentos', value: c.cancelled, d: <Delta cur={c.cancelled} prev={p.cancelled} invert />, icon: 'calendar-x' as const, color: 'var(--danger-text)' },
          { label: 'Faltas', value: c.noShow, d: <Delta cur={c.noShow} prev={p.noShow} invert />, icon: 'user-x' as const, color: 'var(--danger-text)' },
          { label: 'Clientes novos', value: c.newClients, d: <Delta cur={c.newClients} prev={p.newClients} />, icon: 'user-plus' as const, color: 'var(--brand-text)' },
          { label: 'Total de clientes', value: c.totalClients, d: null, icon: 'group' as const, color: 'var(--brand-text)' },
        ].map((k) => (
          <div key={k.label} className="stack-sm">
            <KpiCard label={k.label} value={k.value} icon={k.icon} color={k.color} />
            {k.d}
          </div>
        ))}
      </div>
      <Card title={period === 'year' ? 'Faturamento por mês' : 'Faturamento por dia'}>
        {c.revenueCents === 0 ? (
          <EmptyState icon="line-chart" title="Sem faturamento no período" />
        ) : (
          <>
            <div className="bar-chart" role="img" aria-label="Gráfico de faturamento">
              {r.series.map((s) => (
                <div key={s.key} className={`bar ${s.cents === 0 ? 'empty' : ''}`} style={{ height: `${Math.max(2, (s.cents / maxSeries) * 100)}%` }} title={`${label(s.key)}: ${formatBRL(s.cents)}`} />
              ))}
            </div>
            <div className="bar-labels">
              {r.series.map((s, i) => (
                <span key={s.key}>{period === 'month' && i % 3 !== 0 ? '' : label(s.key)}</span>
              ))}
            </div>
          </>
        )}
      </Card>
      <div className="grid-2">
        <Card title="Top 5 serviços">
          {r.topServices.length === 0 ? (
            <p className="muted sm-text">Sem dados.</p>
          ) : (
            <div className="stack-sm">
              {r.topServices.map((t) => (
                <div key={t.name} className="hbar">
                  <span className="strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  <div className="hbar-track"><div style={{ width: `${(t.totalCents / maxTop) * 100}%` }} /></div>
                  <span className="nowrap xs">{formatBRL(t.totalCents)} · {t.count}×</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Atendimentos por hora (7h às 21h)">
          <div className="bar-chart" style={{ height: 120 }} role="img" aria-label="Atendimentos por hora">
            {r.hours.map((h) => (
              <div key={h.hour} className={`bar ${h.count === 0 ? 'empty' : ''}`} style={{ height: `${Math.max(2, (h.count / maxHour) * 100)}%` }} title={`${h.hour}h: ${h.count}`} />
            ))}
          </div>
          <div className="bar-labels">
            {r.hours.map((h) => (
              <span key={h.hour}>{h.hour % 2 === 1 ? `${h.hour}h` : ''}</span>
            ))}
          </div>
        </Card>
      </div>
      {r.ranking.length > 1 ? (
        <Card title="Faturamento por profissional">
          <div className="stack-sm">
            {r.ranking.map((t, i) => (
              <div key={t.name} className="hbar">
                <span className="strong">{i + 1}º {t.name}</span>
                <div className="hbar-track"><div style={{ width: `${(t.totalCents / maxRank) * 100}%` }} /></div>
                <span className="nowrap xs">{formatBRL(t.totalCents)}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </Page>
  );
}
