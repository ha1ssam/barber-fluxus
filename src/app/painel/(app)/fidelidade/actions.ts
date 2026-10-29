'use server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ActionError, memberForAction, runAction, type ActionResult } from '@/server/context';

const configSchema = z.object({
  loyaltyEnabled: z.boolean(),
  loyaltyStampsRequired: z.number().int().min(2, 'Mínimo de 2 selos.').max(50),
  loyaltyReward: z.string().trim().min(2, 'Descreva o prêmio.').max(60),
  referralEnabled: z.boolean(),
  referralBonusStamps: z.number().int().min(0).max(10),
});

export async function saveLoyaltyAction(raw: z.input<typeof configSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('settings', 'loyalty');
    const parsed = configSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    await db.shop.update({ where: { id: ctx.shop.id }, data: parsed.data });
    return { ok: true, message: 'Fidelidade salva.' };
  });
}

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, 'Use de 3 a 20 letras e números, sem espaço.'),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().positive('Informe o desconto.'),
  validUntil: z.string().optional(),
  maxUses: z.number().int().positive().optional(),
});

export async function createCouponAction(raw: z.input<typeof couponSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('loyalty', 'loyalty');
    const parsed = couponSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const d = parsed.data;
    if (d.type === 'PERCENT' && d.value > 10000) throw new ActionError('O desconto não pode passar de 100%.');
    if (await db.coupon.findUnique({ where: { shopId_code: { shopId: ctx.shop.id, code: d.code } } })) throw new ActionError('Já existe um cupom com esse código.');
    await db.coupon.create({
      data: { shopId: ctx.shop.id, code: d.code, type: d.type, value: d.value, maxUses: d.maxUses ?? null, validUntil: d.validUntil ? new Date(`${d.validUntil}T23:59:59-03:00`) : null },
    });
    return { ok: true, message: 'Cupom criado.' };
  });
}

export async function toggleCouponAction(id: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('loyalty', 'loyalty');
    await db.coupon.updateMany({ where: { id, shopId: ctx.shop.id }, data: { active } });
    return { ok: true };
  });
}
