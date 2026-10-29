import Link from 'next/link';
import { db } from '@/lib/db';
import { hasFeature } from '@/lib/domain/plans';
import { formatBRL, formatPercent } from '@/lib/domain/money';
import { formatDateBR, utcToZoned } from '@/lib/domain/time';
import { FeatureLocked, Page } from '@/components/dashboard/Topbar';
import { Card, EmptyState } from '@/components/ui/basic';
import { canMember, requireMember } from '@/server/context';
import { CouponForm, CouponToggle, LoyaltyConfigForm } from './client';

export const metadata = { title: 'Fidelidade' };

export default async function LoyaltyPage() {
  const ctx = await requireMember('loyalty');
  if (!hasFeature(ctx.plan, 'loyalty')) return <Page title="Fidelidade" icon="purchase-tag"><FeatureLocked feature="Fidelidade" reason={ctx.plan.reason} /></Page>;
  const [coupons, top, rewards] = await Promise.all([
    db.coupon.findMany({ where: { shopId: ctx.shop.id }, orderBy: { createdAt: 'desc' } }),
    db.client.findMany({ where: { shopId: ctx.shop.id, stamps: { gt: 0 } }, orderBy: { stamps: 'desc' }, take: 10 }),
    db.client.count({ where: { shopId: ctx.shop.id, stamps: { gte: ctx.shop.loyaltyStampsRequired } } }),
  ]);
  const s = ctx.shop;
  return (
    <Page title="Fidelidade" icon="purchase-tag">
      <div className="grid-2">
        <Card title="Cartão fidelidade e indicação">
          {canMember(ctx, 'settings') ? (
            <LoyaltyConfigForm
              initial={{
                loyaltyEnabled: s.loyaltyEnabled,
                loyaltyStampsRequired: s.loyaltyStampsRequired,
                loyaltyReward: s.loyaltyReward,
                referralEnabled: s.referralEnabled,
                referralBonusStamps: s.referralBonusStamps,
              }}
            />
          ) : (
            <p className="sm-text">
              A cada atendimento concluído o cliente ganha 1 selo. Com {s.loyaltyStampsRequired} selos ganha {s.loyaltyReward}.
            </p>
          )}
        </Card>
        <Card title={`Quem está perto do prêmio (${rewards} já podem resgatar)`}>
          {top.length === 0 ? (
            <p className="muted sm-text">Os selos aparecem quando os atendimentos forem concluídos no caixa.</p>
          ) : (
            <ul className="list-plain">
              {top.map((c) => (
                <li key={c.id} className="list-item">
                  <Link href={`/painel/clientes/${c.id}`} className="grow strong">
                    {c.name}
                  </Link>
                  <span className={`chip ${c.stamps >= s.loyaltyStampsRequired ? 'success' : 'brand'}`}>
                    {c.stamps}/{s.loyaltyStampsRequired} selos
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Cupons de desconto">
        <div className="stack">
          <CouponForm />
          {coupons.length === 0 ? (
            <EmptyState icon="purchase-tag" title="Nenhum cupom" text="Crie cupons para campanhas no Instagram ou para clientes sumidos. O desconto é aplicado no caixa." />
          ) : (
            <div className="table-wrap">
              <table className="fx-table responsive">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Desconto</th>
                    <th className="num">Usos</th>
                    <th>Validade</th>
                    <th>Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td data-label="Código" className="strong">{c.code}</td>
                      <td data-label="Desconto">{c.type === 'PERCENT' ? formatPercent(c.value) : formatBRL(c.value)}</td>
                      <td data-label="Usos" className="num">
                        {c.uses}
                        {c.maxUses ? ` / ${c.maxUses}` : ''}
                      </td>
                      <td data-label="Validade">{c.validUntil ? formatDateBR(utcToZoned(c.validUntil, ctx.shop.timezone).date) : 'Sem validade'}</td>
                      <td data-label="Ativo">
                        <CouponToggle id={c.id} active={c.active} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </Page>
  );
}
