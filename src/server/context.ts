import 'server-only';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { can, type Permission, type Role } from '@/lib/domain/permissions';
import { hasFeature, planState, type Feature } from '@/lib/domain/plans';

export type MemberContext = NonNullable<Awaited<ReturnType<typeof loadMemberContext>>>;

export async function loadMemberContext() {
  const session = await getSession();
  if (!session) return null;
  const memberships = await db.membership.findMany({
    where: { userId: session.userId, active: true },
    include: { shop: { include: { subscription: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (memberships.length === 0) return { user: session.user, membership: null, shop: null, plan: null, memberships } as const;
  const membership = memberships.find((m) => m.shopId === session.shopId) ?? memberships[0];
  const plan = planState(membership.shop.subscription);
  return { user: session.user, membership, shop: membership.shop, plan, memberships } as const;
}

/** Para páginas do painel: redireciona quem não tem acesso. */
export async function requireMember(permission?: Permission) {
  const ctx = await loadMemberContext();
  if (!ctx) redirect('/entrar?next=/painel');
  if (!ctx.membership || !ctx.shop || !ctx.plan) redirect('/painel/criar-loja');
  if (permission && !can(ctx.membership as { role: Role }, permission)) redirect('/painel?aviso=sem-permissao');
  return { ...ctx, membership: ctx.membership, shop: ctx.shop, plan: ctx.plan };
}

export type Ctx = Awaited<ReturnType<typeof requireMember>>;

export class ActionError extends Error {}

/** Para server actions: devolve erro em vez de redirecionar. */
export async function memberForAction(permission?: Permission, feature?: Feature) {
  const ctx = await loadMemberContext();
  if (!ctx?.membership || !ctx.shop || !ctx.plan) throw new ActionError('Sua sessão expirou. Entre de novo.');
  if (permission && !can(ctx.membership as { role: Role }, permission)) throw new ActionError('Você não tem permissão para isso.');
  if (feature && !hasFeature(ctx.plan, feature)) {
    throw new ActionError(ctx.plan.active ? 'Seu plano não inclui este recurso.' : ctx.plan.reason ?? 'Assinatura inativa.');
  }
  return { ...ctx, membership: ctx.membership, shop: ctx.shop, plan: ctx.plan };
}

export function canMember(ctx: Pick<Ctx, 'membership'>, permission: Permission) {
  return can(ctx.membership as { role: Role; canManageOwnServices: boolean }, permission);
}

/**
 * Qual profissional a pessoa pode operar. Barbeiro só o próprio; dono e recepção, qualquer um da loja.
 */
export async function resolveProfessional(ctx: Ctx, requested?: string | null): Promise<string | null> {
  if (!canMember(ctx, 'agenda.all')) return ctx.membership.isProfessional ? ctx.membership.id : null;
  const pros = await db.membership.findMany({ where: { shopId: ctx.shop.id, active: true, isProfessional: true }, select: { id: true }, orderBy: { createdAt: 'asc' } });
  if (requested && pros.some((p) => p.id === requested)) return requested;
  if (ctx.membership.isProfessional) return ctx.membership.id;
  return pros[0]?.id ?? null;
}

export async function listProfessionals(shopId: string) {
  return db.membership.findMany({
    where: { shopId, active: true, isProfessional: true },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export function memberName(m: { displayName: string | null; user: { name: string } }) {
  return m.displayName || m.user.name;
}

export type ActionResult<T = unknown> = { ok: true; message?: string; data?: T } | { ok: false; error: string };

/** Envolve uma server action para transformar erros de regra em mensagem para a tela. */
export async function runAction<T>(fn: () => Promise<ActionResult<T> | void>): Promise<ActionResult<T>> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) throw e;
    console.error(e);
    return { ok: false, error: 'Algo deu errado. Tente de novo.' };
  }
}
