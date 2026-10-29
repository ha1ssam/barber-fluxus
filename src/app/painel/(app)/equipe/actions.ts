'use server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { randomToken, sha256 } from '@/lib/crypto';
import { emailLayout, sendEmail } from '@/lib/email';
import { canAddProfessional, hasFeature } from '@/lib/domain/plans';
import { ROLE_LABELS } from '@/lib/domain/permissions';
import { ActionError, memberForAction, runAction, type ActionResult } from '@/server/context';

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email('E-mail inválido.'), role: z.enum(['BARBER', 'RECEPTIONIST']) });

/** Convite por link (e e-mail). Não existe busca de usuários: ninguém vê dados de outras lojas. */
export async function inviteAction(raw: z.input<typeof inviteSchema>): Promise<ActionResult<{ link: string }>> {
  return runAction(async () => {
    const ctx = await memberForAction('team');
    if (!hasFeature(ctx.plan, 'team')) throw new ActionError('Equipe está disponível no plano Equipe.');
    const parsed = inviteSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const { email, role } = parsed.data;
    if (role === 'BARBER') {
      const count = await db.membership.count({ where: { shopId: ctx.shop.id, active: true, isProfessional: true } });
      const pending = await db.invitation.count({ where: { shopId: ctx.shop.id, role: 'BARBER', acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } });
      if (!canAddProfessional(ctx.plan, count + pending)) throw new ActionError(`Seu plano permite até ${ctx.plan.effectivePlan.maxProfessionals} profissionais (contando convites pendentes).`);
    }
    const token = randomToken(24);
    await db.invitation.create({ data: { shopId: ctx.shop.id, email, role, tokenHash: sha256(token), invitedById: ctx.user.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    const link = `${env.appUrl}/convite/${token}`;
    await sendEmail(
      email,
      `Convite para a equipe da ${ctx.shop.name}`,
      emailLayout('Você foi convidado', `${ctx.user.name} convidou você para entrar na equipe da ${ctx.shop.name} como ${ROLE_LABELS[role].toLowerCase()}. O convite vale por 7 dias.`, { label: 'Aceitar convite', url: link }),
    );
    return { ok: true, message: 'Convite criado. Envie o link para a pessoa.', data: { link } };
  });
}

export async function revokeInviteAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('team');
    await db.invitation.updateMany({ where: { id, shopId: ctx.shop.id, acceptedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true, message: 'Convite cancelado.' };
  });
}

const memberSchema = z.object({
  id: z.string(),
  displayName: z.string().trim().max(40).optional(),
  role: z.enum(['OWNER', 'BARBER', 'RECEPTIONIST']),
  isProfessional: z.boolean(),
  canManageOwnSchedule: z.boolean(),
  canManageOwnServices: z.boolean(),
  commissionType: z.enum(['DEFAULT', 'NONE', 'PERCENT', 'FIXED', 'CHAIR_RENT']),
  commissionValue: z.number().int().min(0).max(100_000_00).optional(),
});

export async function saveMemberAction(raw: z.input<typeof memberSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('team');
    const parsed = memberSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const d = parsed.data;
    const m = await db.membership.findFirst({ where: { id: d.id, shopId: ctx.shop.id } });
    if (!m) throw new ActionError('Membro não encontrado.');
    if (m.role === 'OWNER' && d.role !== 'OWNER') throw new ActionError('O dono não pode mudar o próprio papel.');
    if (d.role === 'OWNER' && m.role !== 'OWNER') throw new ActionError('Só existe um dono por loja.');
    if (d.commissionType === 'PERCENT' && (d.commissionValue ?? 0) > 10000) throw new ActionError('A comissão não pode passar de 100%.');
    if (d.isProfessional && !m.isProfessional) {
      const count = await db.membership.count({ where: { shopId: ctx.shop.id, active: true, isProfessional: true } });
      if (!canAddProfessional(ctx.plan, count)) throw new ActionError(`Seu plano permite até ${ctx.plan.effectivePlan.maxProfessionals} profissionais.`);
    }
    await db.membership.update({
      where: { id: m.id },
      data: {
        displayName: d.displayName || null,
        role: d.role,
        isProfessional: d.isProfessional,
        canManageOwnSchedule: d.canManageOwnSchedule,
        canManageOwnServices: d.canManageOwnServices,
        commissionType: d.commissionType === 'DEFAULT' ? null : d.commissionType,
        commissionValue: d.commissionType === 'DEFAULT' ? null : (d.commissionValue ?? 0),
      },
    });
    return { ok: true, message: 'Membro salvo.' };
  });
}

export async function removeMemberAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('team');
    const m = await db.membership.findFirst({ where: { id, shopId: ctx.shop.id } });
    if (!m) throw new ActionError('Membro não encontrado.');
    if (m.role === 'OWNER') throw new ActionError('O dono não pode ser removido.');
    const future = await db.appointment.count({ where: { professionalId: m.id, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gt: new Date() } } });
    if (future > 0) throw new ActionError(`Essa pessoa tem ${future} agendamentos futuros. Remarque ou cancele antes de remover.`);
    // O vínculo fica inativo para preservar o histórico de atendimentos e vendas.
    await db.membership.update({ where: { id: m.id }, data: { active: false, isProfessional: false } });
    return { ok: true, message: 'Membro removido da equipe.' };
  });
}

export async function updateShopCommissionAction(type: 'NONE' | 'PERCENT' | 'FIXED' | 'CHAIR_RENT', value: number, productPercent: number): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('team');
    if (!Number.isInteger(value) || value < 0 || !Number.isInteger(productPercent) || productPercent < 0 || productPercent > 10000) throw new ActionError('Valor inválido.');
    if (type === 'PERCENT' && value > 10000) throw new ActionError('A comissão não pode passar de 100%.');
    await db.shop.update({ where: { id: ctx.shop.id }, data: { commissionType: type, commissionValue: value, productCommissionPercent: productPercent } });
    return { ok: true, message: 'Comissão padrão salva.' };
  });
}
