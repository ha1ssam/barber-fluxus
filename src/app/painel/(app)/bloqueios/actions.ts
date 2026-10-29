'use server';
import { db } from '@/lib/db';
import { hhmmToMinute, isValidDate, todayIn, zonedToUtc } from '@/lib/domain/time';
import { ActionError, canMember, memberForAction, runAction, type ActionResult } from '@/server/context';

export async function createBlockAction(input: { professionalId: string; date: string; start: string; end: string; reason?: string; allDay?: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('agenda.own');
    if (!canMember(ctx, 'agenda.all') && (input.professionalId !== ctx.membership.id || !ctx.membership.canManageOwnSchedule)) {
      throw new ActionError('Você não pode bloquear essa agenda.');
    }
    const pro = await db.membership.findFirst({ where: { id: input.professionalId, shopId: ctx.shop.id } });
    if (!pro) throw new ActionError('Profissional não encontrado.');
    if (!isValidDate(input.date)) throw new ActionError('Data inválida.');
    const start = input.allDay ? 0 : hhmmToMinute(input.start);
    const end = input.allDay ? 24 * 60 : hhmmToMinute(input.end);
    if (start === null || end === null || end <= start) throw new ActionError('O fim precisa ser depois do início.');
    await db.timeBlock.create({
      data: {
        shopId: ctx.shop.id,
        professionalId: pro.id,
        startsAt: zonedToUtc(input.date, start, ctx.shop.timezone),
        endsAt: zonedToUtc(input.date, end, ctx.shop.timezone),
        reason: input.reason?.trim() || null,
      },
    });
    return { ok: true, message: 'Horário bloqueado.' };
  });
}

export async function deleteBlockAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('agenda.own');
    const block = await db.timeBlock.findFirst({ where: { id, shopId: ctx.shop.id } });
    if (!block) throw new ActionError('Bloqueio não encontrado.');
    if (!canMember(ctx, 'agenda.all') && block.professionalId !== ctx.membership.id) throw new ActionError('Você não pode remover esse bloqueio.');
    await db.timeBlock.delete({ where: { id } });
    return { ok: true, message: 'Bloqueio removido.' };
  });
}

export async function clearOldBlocksAction(): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('agenda.all');
    const r = await db.timeBlock.deleteMany({ where: { shopId: ctx.shop.id, endsAt: { lt: zonedToUtc(todayIn(ctx.shop.timezone), 0, ctx.shop.timezone) } } });
    return { ok: true, message: r.count ? `${r.count} bloqueios antigos removidos.` : 'Não havia bloqueios antigos.' };
  });
}
