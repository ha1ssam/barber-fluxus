import { formatBRL, formatPercent } from '@/lib/domain/money';
import { COMMISSION_LABELS } from '@/lib/domain/commission';
import { hasFeature } from '@/lib/domain/plans';
import { addMonths, formatDateBR, startOfMonth, todayIn, zonedToUtc, addDays } from '@/lib/domain/time';
import { FeatureLocked, Page } from '@/components/dashboard/Topbar';
import { Card, EmptyState } from '@/components/ui/basic';
import { requireMember } from '@/server/context';
import { commissionReport } from '@/server/finance';
import { MonthNav } from './client';

export const metadata = { title: 'Comissões' };

function ruleText(type: string, value: number) {
  if (type === 'PERCENT') return `${formatPercent(value)} dos serviços`;
  if (type === 'FIXED') return `${formatBRL(value)} por serviço`;
  if (type === 'CHAIR_RENT') return `Aluguel de ${formatBRL(value)}/mês`;
  return 'Sem comissão';
}

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember('reports');
  if (!hasFeature(ctx.plan, 'commission')) return <Page title="Comissões" icon="receipt"><FeatureLocked feature="Comissões" reason={ctx.plan.active ? undefined : ctx.plan.reason} /></Page>;
  const tz = ctx.shop.timezone;
  const today = todayIn(tz);
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : startOfMonth(today);
  const end = addMonths(month, 1);
  const rows = await commissionReport(ctx.shop.id, zonedToUtc(month, 0, tz), zonedToUtc(end, 0, tz));
  const totals = rows.reduce((a, r) => ({ pro: a.pro + r.professionalCents, shop: a.shop + r.shopCents, prod: a.prod + r.production.serviceRevenueCents + r.production.productRevenueCents }), { pro: 0, shop: 0, prod: 0 });
  return (
    <Page title="Comissões" icon="receipt" badge={`${formatDateBR(month)} a ${formatDateBR(addDays(end, -1))}`}>
      <div className="row-between">
        <MonthNav month={month.slice(0, 7)} />
        <span className="muted sm-text">Regra padrão da loja: {ruleText(ctx.shop.commissionType, ctx.shop.commissionValue)}. Ajuste por profissional em Equipe.</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="receipt" title="Nenhum profissional" />
      ) : (
        <Card>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="fx-table responsive">
              <thead>
                <tr>
                  <th>Profissional</th>
                  <th>Regra</th>
                  <th className="num">Atendimentos</th>
                  <th className="num">Serviços</th>
                  <th className="num">Produtos</th>
                  <th className="num">A pagar ao profissional</th>
                  <th className="num">Fica com a loja</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.membership.id}>
                    <td data-label="Profissional" className="strong">{r.name}</td>
                    <td data-label="Regra" className="xs">{r.type === 'NONE' ? COMMISSION_LABELS.NONE : `${COMMISSION_LABELS[r.type]} · ${ruleText(r.type, r.value)}`}</td>
                    <td data-label="Atendimentos" className="num">{r.production.serviceCount}</td>
                    <td data-label="Serviços" className="num">{formatBRL(r.production.serviceRevenueCents)}</td>
                    <td data-label="Produtos" className="num">{formatBRL(r.production.productRevenueCents)}</td>
                    <td data-label="A pagar" className="num strong success-text">{formatBRL(r.professionalCents)}</td>
                    <td data-label="Fica com a loja" className="num">{formatBRL(r.shopCents)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td data-label="" className="strong" colSpan={3}>Total</td>
                  <td data-label="Produção" className="num strong" colSpan={2}>{formatBRL(totals.prod)}</td>
                  <td data-label="A pagar" className="num strong">{formatBRL(totals.pro)}</td>
                  <td data-label="Fica com a loja" className="num strong">{formatBRL(totals.shop)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="muted xs">No aluguel de cadeira, o profissional fica com o valor dos serviços e a loja recebe o aluguel do mês.</p>
    </Page>
  );
}
