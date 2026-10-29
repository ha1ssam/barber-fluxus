import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { formatBRL } from '@/lib/domain/money';
import { PLANS } from '@/lib/domain/plans';
import { formatDateBR, utcToZoned } from '@/lib/domain/time';
import { Page } from '@/components/dashboard/Topbar';
import { Button, Card, Notice } from '@/components/ui/basic';
import { Icon } from '@/components/ui/Icon';
import { memberForAction, requireMember } from '@/server/context';
import { createCheckout, createPortal, stripeEnabled } from '@/server/stripe';

export const metadata = { title: 'Assinatura' };

async function checkoutAction(form: FormData) {
  'use server';
  const ctx = await memberForAction('billing');
  const url = await createCheckout(ctx.shop, String(form.get('plan')), ctx.user.email);
  redirect(url);
}

async function portalAction() {
  'use server';
  const ctx = await memberForAction('billing');
  const sub = await db.subscription.findUnique({ where: { shopId: ctx.shop.id } });
  if (!sub?.stripeCustomerId) redirect('/painel/assinatura');
  redirect(await createPortal(sub.stripeCustomerId));
}

const STATUS: Record<string, string> = { TRIALING: 'Em teste', ACTIVE: 'Ativa', PAST_DUE: 'Pagamento pendente', CANCELED: 'Cancelada (vale até o fim do período)', EXPIRED: 'Vencida' };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember('billing');
  const sub = ctx.shop.subscription;
  const tz = ctx.shop.timezone;
  const enabled = stripeEnabled();
  const pros = await db.membership.count({ where: { shopId: ctx.shop.id, active: true, isProfessional: true } });
  return (
    <Page title="Assinatura" icon="credit-card">
      {sp.status === 'sucesso' ? <Notice type="success">Pagamento recebido. Pode levar alguns segundos para a assinatura aparecer como ativa.</Notice> : null}
      <Card title="Sua assinatura">
        <div className="stack-sm sm-text">
          <div className="row-between"><span>Status</span><span className={`chip ${ctx.plan.active ? 'success' : 'danger'}`}>{sub ? STATUS[sub.status] : 'Sem assinatura'}</span></div>
          <div className="row-between"><span>Plano</span><span className="strong">{ctx.plan.trialing ? `Teste com recursos do ${PLANS.equipe.name}` : ctx.plan.plan.name}</span></div>
          {sub?.status === 'TRIALING' ? <div className="row-between"><span>Teste termina em</span><span>{formatDateBR(utcToZoned(sub.trialEndsAt, tz).date)}</span></div> : null}
          {sub?.currentPeriodEnd ? <div className="row-between"><span>{sub.cancelAtPeriodEnd ? 'Acesso até' : 'Próxima renovação'}</span><span>{formatDateBR(utcToZoned(sub.currentPeriodEnd, tz).date)}</span></div> : null}
          {!ctx.plan.active ? <p className="danger-text">{ctx.plan.reason} Novos agendamentos e serviços ficam bloqueados até assinar.</p> : null}
          {sub?.stripeCustomerId && enabled ? (
            <form action={portalAction} className="row" style={{ justifyContent: 'flex-end' }}>
              <Button type="submit" variant="ghost" icon="credit-card">Trocar cartão, ver faturas ou cancelar</Button>
            </form>
          ) : null}
        </div>
      </Card>
      {!enabled ? <Notice type="info">Pagamentos não configurados neste servidor (defina as chaves do Stripe no .env).</Notice> : null}
      <div className="grid-2">
        {Object.values(PLANS).map((p) => {
          const current = sub?.status === 'ACTIVE' && sub.plan === p.id;
          const tooSmall = pros > p.maxProfessionals;
          return (
            <Card key={p.id}>
              <div className="stack">
                <div>
                  <p className="eyebrow">{p.tagline}</p>
                  <h2 className="section-title" style={{ marginTop: 4 }}>{p.name}</h2>
                </div>
                <div>
                  <span className="kpi-value">{formatBRL(p.priceCents)}</span> <span className="muted">/mês</span>
                </div>
                <ul className="list-plain stack-sm sm-text">
                  {p.highlights.map((h) => (
                    <li key={h} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                      <Icon name="check" size={16} style={{ color: 'var(--success-text)', marginTop: 2 }} />
                      {h}
                    </li>
                  ))}
                </ul>
                <form action={checkoutAction}>
                  <input type="hidden" name="plan" value={p.id} />
                  <Button type="submit" variant={p.id === 'equipe' ? 'primary' : 'ghost'} disabled={!enabled || current || tooSmall} style={{ width: '100%' }}>
                    {current ? 'Plano atual' : tooSmall ? `Você tem ${pros} profissionais` : `Assinar ${p.name}`}
                  </Button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="muted xs">Pagamento com cartão pelo Stripe. Cancelamento vale no fim do período pago.</p>
    </Page>
  );
}
