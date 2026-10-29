import 'server-only';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { hmacSha256Hex, safeEqual } from '@/lib/crypto';
import { isPlanId } from '@/lib/domain/plans';

// Integração com o Stripe por HTTP (sem SDK): checkout, portal e webhook.

async function stripe(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.stripeKey()}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe ${res.status}`);
  return json;
}

export function stripeEnabled() {
  return !!env.stripeKey() && !!env.stripePrice('essencial') && !!env.stripePrice('equipe');
}

export async function createCheckout(shop: { id: string; name: string }, plan: string, email: string) {
  if (!isPlanId(plan)) throw new Error('Plano inválido.');
  const sub = await db.subscription.findUnique({ where: { shopId: shop.id } });
  const params: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': env.stripePrice(plan),
    'line_items[0][quantity]': '1',
    success_url: `${env.appUrl}/painel/assinatura?status=sucesso`,
    cancel_url: `${env.appUrl}/painel/assinatura`,
    client_reference_id: shop.id,
    'metadata[shopId]': shop.id,
    'metadata[plan]': plan,
    'subscription_data[metadata][shopId]': shop.id,
    'subscription_data[metadata][plan]': plan,
    locale: 'pt-BR',
    'payment_method_types[0]': 'card',
  };
  if (sub?.stripeCustomerId) params.customer = sub.stripeCustomerId;
  else params.customer_email = email;
  const session = await stripe('checkout/sessions', params);
  return session.url as string;
}

export async function createPortal(customerId: string) {
  const session = await stripe('billing_portal/sessions', { customer: customerId, return_url: `${env.appUrl}/painel/assinatura` });
  return session.url as string;
}

/** Verifica a assinatura do webhook (header Stripe-Signature, tolerância de 5 minutos). */
export function verifyStripeSignature(payload: string, header: string | null, now = Date.now()): boolean {
  const secret = env.stripeWebhookSecret();
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  const v1s = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = hmacSha256Hex(secret, `${t}.${payload}`);
  return v1s.some((v) => safeEqual(v, expected));
}

const PERIOD_DAYS = 30;

/** Aplica um evento do Stripe à assinatura da loja. O período de 30 dias é calculado aqui, como no Fluxus. */
export async function applyStripeEvent(event: { type: string; data: { object: Record<string, unknown> } }) {
  const obj = event.data.object as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const now = new Date();
  if (event.type === 'checkout.session.completed') {
    const shopId = obj.metadata?.shopId ?? obj.client_reference_id;
    const plan = obj.metadata?.plan;
    if (!shopId || !isPlanId(plan)) return;
    await db.subscription.update({
      where: { shopId },
      data: { plan, status: 'ACTIVE', stripeCustomerId: obj.customer, stripeSubscriptionId: obj.subscription, currentPeriodEnd: new Date(now.getTime() + PERIOD_DAYS * 86_400_000), cancelAtPeriodEnd: false },
    });
  } else if (event.type === 'invoice.paid') {
    const sub = await db.subscription.findFirst({ where: { OR: [{ stripeSubscriptionId: obj.subscription }, { stripeCustomerId: obj.customer }] } });
    if (!sub) return;
    const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    await db.subscription.update({ where: { id: sub.id }, data: { status: sub.cancelAtPeriodEnd ? 'CANCELED' : 'ACTIVE', currentPeriodEnd: new Date(base.getTime() + PERIOD_DAYS * 86_400_000) } });
  } else if (event.type === 'invoice.payment_failed') {
    await db.subscription.updateMany({ where: { stripeSubscriptionId: obj.subscription }, data: { status: 'PAST_DUE' } });
  } else if (event.type === 'customer.subscription.updated') {
    const plan = obj.metadata?.plan;
    await db.subscription.updateMany({
      where: { stripeSubscriptionId: obj.id },
      data: { cancelAtPeriodEnd: !!obj.cancel_at_period_end, ...(obj.cancel_at_period_end ? { status: 'CANCELED' } : {}), ...(isPlanId(plan) ? { plan } : {}) },
    });
  } else if (event.type === 'customer.subscription.deleted') {
    // Cancelamento vale no fim do período; depois disso o planState trata como vencida.
    await db.subscription.updateMany({ where: { stripeSubscriptionId: obj.id }, data: { status: 'CANCELED', cancelAtPeriodEnd: true } });
  }
}
