import { formatBRL } from '@/lib/domain/money';
import { formatDateBR, isValidDate, minuteToHHMM, todayIn, utcToZoned } from '@/lib/domain/time';
import { FeatureLocked, Page } from '@/components/dashboard/Topbar';
import { Card, EmptyState, KpiCard } from '@/components/ui/basic';
import { hasFeature } from '@/lib/domain/plans';
import { memberName, requireMember } from '@/server/context';
import { daySummary, PAYMENT_LABELS } from '@/server/finance';
import { CashActions, DateNav, DeleteSaleButton } from './client';

export const metadata = { title: 'Caixa' };

const MOVEMENT_LABELS = { EXPENSE: 'Despesa', WITHDRAWAL: 'Sangria', DEPOSIT: 'Suprimento' } as const;

export default async function CashPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember('cash');
  if (!hasFeature(ctx.plan, 'cash')) return <Page title="Caixa" icon="wallet"><FeatureLocked feature="Caixa" reason={ctx.plan.reason} /></Page>;
  const tz = ctx.shop.timezone;
  const today = todayIn(tz);
  const date = sp.data && isValidDate(sp.data) ? sp.data : today;
  const s = await daySummary(ctx.shop.id, date, tz);
  const registerOpen = !!s.register && !s.register.closedAt;
  const time = (d: Date) => minuteToHHMM(utcToZoned(d, tz).minute);

  return (
    <Page title="Caixa" icon="wallet" badge={formatDateBR(date)} actions={<CashActions registerOpen={registerOpen} expectedCash={s.expectedCash} isToday={date === today} />}>
      <DateNav date={date} today={today} />
      <div className="kpi-grid">
        <KpiCard label="Vendas do dia" value={formatBRL(s.totalSales)} sub={`${s.sales.length} vendas`} icon="wallet" color="var(--success-text)" />
        <KpiCard label="Serviços" value={formatBRL(s.services)} icon="cut" color="var(--brand-text)" />
        <KpiCard label="Produtos" value={formatBRL(s.productsTotal)} icon="package" color="var(--brand-text)" />
        <KpiCard label="Despesas e sangrias" value={formatBRL(s.expenses + s.withdrawals)} icon="receipt" color="var(--danger-text)" />
        <KpiCard label="Saldo do dia" value={formatBRL(s.net)} icon="line-chart" color="var(--success-text)" />
      </div>
      <div className="grid-main-aside">
        <Card title="Vendas">
          {s.sales.length === 0 ? (
            <EmptyState icon="wallet" title="Nenhuma venda neste dia" text="Ao concluir um atendimento, a venda entra aqui com a forma de pagamento." />
          ) : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="fx-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Itens</th>
                    <th>Pagamento</th>
                    <th className="num">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {s.sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{time(sale.createdAt)}</td>
                      <td>
                        <div className="strong">{sale.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.description}` : i.description)).join(' + ')}</div>
                        <div className="muted xs">
                          {sale.client?.name ?? 'Venda avulsa'}
                          {sale.professional ? ` · ${memberName(sale.professional)}` : ''}
                          {sale.discountCents ? ` · desconto ${formatBRL(sale.discountCents)}` : ''}
                          {sale.rewardRedeemed ? ' · prêmio fidelidade' : ''}
                        </div>
                      </td>
                      <td>{PAYMENT_LABELS[sale.paymentMethod]}</td>
                      <td className="num strong">{formatBRL(sale.totalCents)}</td>
                      <td className="num">{ctx.membership.role === 'OWNER' ? <DeleteSaleButton saleId={sale.id} /> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="stack">
          <Card title="Por forma de pagamento">
            <div className="stack-sm sm-text">
              {(['PIX', 'CASH', 'CREDIT', 'DEBIT', 'OTHER'] as const).map((m) =>
                s.byMethod[m] ? (
                  <div key={m} className="row-between">
                    <span>{PAYMENT_LABELS[m]}</span>
                    <span className="strong">{formatBRL(s.byMethod[m])}</span>
                  </div>
                ) : null,
              )}
              {Object.keys(s.byMethod).length === 0 ? <span className="muted">Sem vendas.</span> : null}
            </div>
          </Card>
          <Card title="Gaveta (dinheiro)">
            {s.register ? (
              <div className="stack-sm sm-text">
                <div className="row-between"><span>Aberto às</span><span>{time(s.register.openedAt)}</span></div>
                <div className="row-between"><span>Troco inicial</span><span>{formatBRL(s.register.openingCents)}</span></div>
                <div className="row-between"><span>Esperado na gaveta</span><span className="strong">{formatBRL(s.expectedCash ?? 0)}</span></div>
                {s.register.closedAt ? (
                  <>
                    <div className="row-between"><span>Fechado às</span><span>{time(s.register.closedAt)}</span></div>
                    <div className="row-between"><span>Contado</span><span>{formatBRL(s.register.countedCents ?? 0)}</span></div>
                    <div className="row-between">
                      <span>Diferença</span>
                      <span className={(s.register.countedCents ?? 0) - (s.expectedCash ?? 0) < 0 ? 'danger-text strong' : 'success-text strong'}>
                        {formatBRL((s.register.countedCents ?? 0) - (s.expectedCash ?? 0))}
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="muted sm-text">Abra o caixa para controlar o dinheiro da gaveta. As vendas funcionam mesmo com o caixa fechado.</p>
            )}
          </Card>
          <Card title="Lançamentos">
            {s.movements.length === 0 ? (
              <p className="muted sm-text">Nenhuma despesa, sangria ou suprimento.</p>
            ) : (
              <ul className="list-plain">
                {s.movements.map((m) => (
                  <li key={m.id} className="list-item sm-text">
                    <div className="grow">
                      <div className="strong">{m.description}</div>
                      <div className="muted xs">
                        {MOVEMENT_LABELS[m.type]} · {time(m.createdAt)}
                      </div>
                    </div>
                    <span className={m.type === 'DEPOSIT' ? 'success-text strong' : 'danger-text strong'}>
                      {m.type === 'DEPOSIT' ? '+' : '−'}
                      {formatBRL(m.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
