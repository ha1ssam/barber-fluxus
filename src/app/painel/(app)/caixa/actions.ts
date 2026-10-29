'use server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ActionError, memberForAction, runAction, type ActionResult } from '@/server/context';
import { openRegister } from '@/server/finance';

export async function openRegisterAction(openingCents: number): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('cash', 'cash');
    if (!Number.isInteger(openingCents) || openingCents < 0) throw new ActionError('Valor inválido.');
    if (await openRegister(ctx.shop.id)) throw new ActionError('Já existe um caixa aberto.');
    await db.cashRegister.create({ data: { shopId: ctx.shop.id, openedById: ctx.user.id, openingCents } });
    return { ok: true, message: 'Caixa aberto.' };
  });
}

export async function closeRegisterAction(countedCents: number, notes: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('cash', 'cash');
    if (!Number.isInteger(countedCents) || countedCents < 0) throw new ActionError('Valor inválido.');
    const reg = await openRegister(ctx.shop.id);
    if (!reg) throw new ActionError('Nenhum caixa aberto.');
    await db.cashRegister.update({ where: { id: reg.id }, data: { closedAt: new Date(), closedById: ctx.user.id, countedCents, notes: notes.trim() || null } });
    return { ok: true, message: 'Caixa fechado.' };
  });
}

const movementSchema = z.object({
  type: z.enum(['EXPENSE', 'WITHDRAWAL', 'DEPOSIT']),
  amountCents: z.number().int().positive('Informe o valor.'),
  description: z.string().trim().min(2, 'Descreva o lançamento.').max(120),
});

export async function addMovementAction(raw: z.input<typeof movementSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('cash', 'cash');
    const parsed = movementSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const reg = await openRegister(ctx.shop.id);
    await db.cashMovement.create({ data: { ...parsed.data, shopId: ctx.shop.id, registerId: reg?.id ?? null, createdById: ctx.user.id } });
    return { ok: true, message: 'Lançamento registrado.' };
  });
}

export async function deleteSaleAction(saleId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('cash', 'cash');
    if (ctx.membership.role !== 'OWNER') throw new ActionError('Só o dono pode estornar vendas.');
    const sale = await db.sale.findFirst({ where: { id: saleId, shopId: ctx.shop.id } });
    if (!sale) throw new ActionError('Venda não encontrada.');
    await db.$transaction(async (tx) => {
      if (sale.appointmentId) await tx.appointment.update({ where: { id: sale.appointmentId }, data: { status: 'CONFIRMED', completedAt: null } });
      if (sale.couponId) await tx.coupon.update({ where: { id: sale.couponId }, data: { uses: { decrement: 1 } } });
      await tx.sale.delete({ where: { id: sale.id } });
    });
    return { ok: true, message: sale.appointmentId ? 'Venda estornada. O agendamento voltou para confirmado.' : 'Venda estornada.' };
  });
}
