import type { ReactNode } from 'react';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { setActiveShop } from '@/lib/auth/session';
import { hasFeature } from '@/lib/domain/plans';
import { NAV } from '@/components/dashboard/nav';
import { Shell } from '@/components/dashboard/Shell';
import { canMember, requireMember } from '@/server/context';

export const dynamic = 'force-dynamic';

async function switchShop(form: FormData) {
  'use server';
  const ctx = await requireMember();
  const shopId = String(form.get('shopId'));
  if (ctx.memberships.some((m) => m.shopId === shopId)) await setActiveShop(shopId);
  revalidatePath('/painel', 'layout');
}

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const ctx = await requireMember();
  const items = NAV.filter((n) => (!n.permission || canMember(ctx, n.permission)) && (!n.feature || hasFeature(ctx.plan, n.feature) || (n.permission && canMember(ctx, 'billing'))));
  const own = canMember(ctx, 'agenda.all') ? {} : { professionalId: ctx.membership.id };
  const pendingCount = await db.appointment.count({ where: { shopId: ctx.shop.id, status: 'PENDING', startsAt: { gte: new Date() }, ...own } });
  const p = ctx.plan;
  const billing = canMember(ctx, 'billing');
  const banner = !p.active
    ? { text: p.reason ?? 'Assinatura inativa.', href: '/painel/assinatura', cta: billing ? 'Assinar agora' : 'Ver detalhes', expired: true }
    : p.trialing
      ? { text: `Teste grátis: ${p.trialDaysLeft} ${p.trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'} com todos os recursos.`, href: '/painel/assinatura', cta: 'Escolher plano', expired: false }
      : null;
  return (
    <Shell
      items={items.map(({ href, label, icon, category }) => ({ href, label, icon, category }))}
      user={{
        name: ctx.user.name,
        shop: ctx.shop.name,
        plan: p.trialing ? 'Teste' : p.plan.name,
        planTier: !p.active ? 'free' : p.effectivePlan.id === 'equipe' ? 'team' : 'pro',
      }}
      pendingCount={pendingCount}
      banner={banner && (billing || banner.expired) ? banner : null}
      shops={ctx.memberships.map((m) => ({ id: m.shopId, name: m.shop.name }))}
      activeShopId={ctx.shop.id}
      switchShop={switchShop}
    >
      {children}
    </Shell>
  );
}
