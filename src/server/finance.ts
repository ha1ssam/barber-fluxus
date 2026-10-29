import 'server-only';
import type { PaymentMethod } from '@prisma/client';
import { db } from '@/lib/db';
import { canTransition } from '@/lib/domain/appointment-status';
import { computeCommission, type CommissionType } from '@/lib/domain/commission';
import { couponDiscount, couponProblem, hasReward } from '@/lib/domain/loyalty';
import { dayRangeUtc } from '@/lib/domain/time';
import { enqueueAppointmentMessage } from './messages';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  OTHER: 'Outro',
};

export async function openRegister(shopId: string) {
  return db.cashRegister.findFirst({ where: { shopId, closedAt: null }, orderBy: { openedAt: 'desc' } });
}

export interface CheckoutInput {
  shopId: string;
  userId: string;
  appointmentId?: string;
  clientId?: string | null;
  professionalId?: string | null;
  products: { productId: string; quantity: number }[];
  paymentMethod: PaymentMethod;
  couponCode?: string | null;
  redeemReward?: boolean;
  now?: Date;
}

/**
 * Fecha uma venda no caixa. Com agendamento, marca como concluído (só depois do término),
 * soma selo de fidelidade, paga bônus de indicação e agenda o pedido de avaliação.
 */
export async function checkout(input: CheckoutInput): Promise<{ ok: true; saleId: string; totalCents: number } | { ok: false; error: string }> {
  const now = input.now ?? new Date();
  const shop = await db.shop.findUnique({ where: { id: input.shopId } });
  if (!shop) return { ok: false, error: 'Loja não encontrada.' };

  const appt = input.appointmentId
    ? await db.appointment.findFirst({ where: { id: input.appointmentId, shopId: shop.id }, include: { services: true, client: true } })
    : null;
  if (input.appointmentId && !appt) return { ok: false, error: 'Agendamento não encontrado.' };
  if (appt) {
    const check = canTransition(appt.status, 'COMPLETED', { endsAt: appt.endsAt, now });
    if (!check.ok) return check;
  }

  const productIds = input.products.filter((p) => p.quantity > 0).map((p) => p.productId);
  const products = productIds.length ? await db.product.findMany({ where: { id: { in: productIds }, shopId: shop.id } }) : [];
  if (products.length !== new Set(productIds).size) return { ok: false, error: 'Produto não encontrado.' };

  const professionalId = appt?.professionalId ?? input.professionalId ?? null;
  const clientId = appt?.clientId ?? input.clientId ?? null;
  const items = [
    ...(appt?.services ?? []).map((s) => ({
      kind: 'SERVICE' as const,
      serviceId: s.serviceId,
      professionalId,
      description: s.name,
      quantity: 1,
      unitCents: s.priceCents,
      totalCents: s.priceCents,
    })),
    ...input.products
      .filter((p) => p.quantity > 0)
      .map((p) => {
        const prod = products.find((x) => x.id === p.productId)!;
        return {
          kind: 'PRODUCT' as const,
          productId: prod.id,
          professionalId,
          description: prod.name,
          quantity: p.quantity,
          unitCents: prod.priceCents,
          totalCents: prod.priceCents * p.quantity,
        };
      }),
  ];
  if (items.length === 0) return { ok: false, error: 'Adicione pelo menos um item.' };
  const subtotal = items.reduce((s, i) => s + i.totalCents, 0);

  const client = clientId ? await db.client.findUnique({ where: { id: clientId } }) : null;
  let discount = 0;
  let couponId: string | null = null;
  if (input.couponCode?.trim()) {
    const coupon = await db.coupon.findUnique({ where: { shopId_code: { shopId: shop.id, code: input.couponCode.trim().toUpperCase() } } });
    if (!coupon) return { ok: false, error: 'Cupom não encontrado.' };
    const problem = couponProblem(coupon, now);
    if (problem) return { ok: false, error: problem };
    discount += couponDiscount(coupon, subtotal);
    couponId = coupon.id;
  }
  let rewardRedeemed = false;
  if (input.redeemReward) {
    const cfg = { enabled: shop.loyaltyEnabled, stampsRequired: shop.loyaltyStampsRequired };
    if (!client || !hasReward(client.stamps, cfg)) return { ok: false, error: 'O cliente ainda não tem prêmio de fidelidade.' };
    const topService = Math.max(0, ...items.filter((i) => i.kind === 'SERVICE').map((i) => i.unitCents));
    discount += topService;
    rewardRedeemed = true;
  }
  discount = Math.min(discount, subtotal);
  const register = await openRegister(shop.id);

  const sale = await db.$transaction(async (tx) => {
    if (appt) {
      const updated = await tx.appointment.updateMany({ where: { id: appt.id, status: appt.status }, data: { status: 'COMPLETED', completedAt: now } });
      if (updated.count === 0) throw new Error('STALE');
    }
    if (couponId) await tx.coupon.update({ where: { id: couponId }, data: { uses: { increment: 1 } } });
    const created = await tx.sale.create({
      data: {
        shopId: shop.id,
        registerId: register?.id ?? null,
        appointmentId: appt?.id ?? null,
        clientId,
        professionalId,
        subtotalCents: subtotal,
        discountCents: discount,
        totalCents: subtotal - discount,
        paymentMethod: input.paymentMethod,
        couponId,
        rewardRedeemed,
        createdById: input.userId,
        items: { create: items },
      },
    });
    if (client && shop.loyaltyEnabled) {
      let delta = 0;
      if (rewardRedeemed) {
        delta -= shop.loyaltyStampsRequired;
        await tx.loyaltyEvent.create({ data: { shopId: shop.id, clientId: client.id, delta: -shop.loyaltyStampsRequired, reason: 'REDEEM', appointmentId: appt?.id } });
      }
      if (appt) {
        delta += 1;
        await tx.loyaltyEvent.create({ data: { shopId: shop.id, clientId: client.id, delta: 1, reason: 'VISIT', appointmentId: appt.id } });
      }
      if (delta !== 0) await tx.client.update({ where: { id: client.id }, data: { stamps: { increment: delta } } });
      // Indicação: na primeira visita concluída do indicado, quem indicou ganha selos.
      if (appt && shop.referralEnabled && client.referredById && shop.referralBonusStamps > 0) {
        const previous = await tx.appointment.count({ where: { clientId: client.id, status: 'COMPLETED', id: { not: appt.id } } });
        if (previous === 0) {
          await tx.client.update({ where: { id: client.referredById }, data: { stamps: { increment: shop.referralBonusStamps } } });
          await tx.loyaltyEvent.create({ data: { shopId: shop.id, clientId: client.referredById, delta: shop.referralBonusStamps, reason: 'REFERRAL', appointmentId: appt.id } });
        }
      }
    }
    return created;
  }).catch((e) => {
    if (e instanceof Error && e.message === 'STALE') return null;
    throw e;
  });
  if (!sale) return { ok: false, error: 'O agendamento mudou enquanto você editava. Atualize a página.' };

  if (appt) await enqueueAppointmentMessage(appt.id, 'REVIEW_REQUEST', new Date(now.getTime() + 60 * 60_000));
  return { ok: true, saleId: sale.id, totalCents: sale.totalCents };
}

export async function daySummary(shopId: string, date: string, tz: string) {
  const { start, end } = dayRangeUtc(date, tz);
  const [sales, movements, register] = await Promise.all([
    db.sale.findMany({
      where: { shopId, createdAt: { gte: start, lt: end } },
      include: { items: true, client: { select: { name: true } }, professional: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.cashMovement.findMany({ where: { shopId, createdAt: { gte: start, lt: end } }, orderBy: { createdAt: 'desc' } }),
    db.cashRegister.findFirst({ where: { shopId, openedAt: { lt: end }, OR: [{ closedAt: null }, { closedAt: { gte: start } }] }, orderBy: { openedAt: 'desc' } }),
  ]);
  const byMethod: Record<string, number> = {};
  for (const s of sales) byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] ?? 0) + s.totalCents;
  const totalSales = sales.reduce((s, x) => s + x.totalCents, 0);
  const services = sales.flatMap((s) => s.items).filter((i) => i.kind === 'SERVICE').reduce((s, i) => s + i.totalCents, 0);
  const productsTotal = sales.flatMap((s) => s.items).filter((i) => i.kind === 'PRODUCT').reduce((s, i) => s + i.totalCents, 0);
  const sum = (t: string) => movements.filter((m) => m.type === t).reduce((s, m) => s + m.amountCents, 0);
  const expenses = sum('EXPENSE');
  const withdrawals = sum('WITHDRAWAL');
  const deposits = sum('DEPOSIT');
  const registerSales = register ? sales.filter((s) => s.registerId === register.id && s.paymentMethod === 'CASH').reduce((a, s) => a + s.totalCents, 0) : 0;
  const registerMovements = register ? movements.filter((m) => m.registerId === register.id) : [];
  const expectedCash = register
    ? register.openingCents +
      registerSales +
      registerMovements.filter((m) => m.type === 'DEPOSIT').reduce((a, m) => a + m.amountCents, 0) -
      registerMovements.filter((m) => m.type !== 'DEPOSIT').reduce((a, m) => a + m.amountCents, 0)
    : null;
  return { sales, movements, register, byMethod, totalSales, services, productsTotal, expenses, withdrawals, deposits, expectedCash, net: totalSales + deposits - expenses - withdrawals };
}

/** Comissão de cada profissional num período, a partir das vendas. */
export async function commissionReport(shopId: string, start: Date, end: Date) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const members = await db.membership.findMany({ where: { shopId, isProfessional: true }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } });
  const items = await db.saleItem.findMany({ where: { sale: { shopId, createdAt: { gte: start, lt: end } } }, select: { kind: true, professionalId: true, totalCents: true, quantity: true } });
  return members.map((m) => {
    const mine = items.filter((i) => i.professionalId === m.id);
    const production = {
      serviceRevenueCents: mine.filter((i) => i.kind === 'SERVICE').reduce((s, i) => s + i.totalCents, 0),
      serviceCount: mine.filter((i) => i.kind === 'SERVICE').reduce((s, i) => s + i.quantity, 0),
      productRevenueCents: mine.filter((i) => i.kind === 'PRODUCT').reduce((s, i) => s + i.totalCents, 0),
    };
    const type = (m.commissionType ?? (m.role === 'OWNER' ? 'NONE' : shop.commissionType)) as CommissionType;
    const value = m.commissionValue ?? shop.commissionValue;
    const result = computeCommission({ type, value, productPercent: shop.productCommissionPercent }, production);
    return { membership: m, name: m.displayName || m.user.name, type, value, production, ...result };
  });
}
