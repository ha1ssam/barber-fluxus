'use server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { normalizePhone } from '@/lib/domain/phone';
import { isValidDate } from '@/lib/domain/time';
import { uniqueReferralCode } from '@/server/clients';
import { ActionError, memberForAction, runAction, type ActionResult } from '@/server/context';

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Informe o nome.').max(80),
  phone: z.string().trim().min(8, 'Informe o telefone.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').or(z.literal('')).optional(),
  birthDate: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function saveClientAction(raw: z.input<typeof schema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await memberForAction('clients');
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const d = parsed.data;
    const phone = normalizePhone(d.phone);
    if (!phone) throw new ActionError('Telefone inválido. Use DDD + número.');
    if (d.birthDate && !isValidDate(d.birthDate)) throw new ActionError('Data de nascimento inválida.');
    const dup = await db.client.findUnique({ where: { shopId_phone: { shopId: ctx.shop.id, phone } } });
    if (dup && dup.id !== d.id) throw new ActionError(`Já existe um cliente com este telefone: ${dup.name}.`);
    const data = { name: d.name, phone, email: d.email || null, birthDate: d.birthDate ? new Date(`${d.birthDate}T00:00:00Z`) : null, notes: d.notes || null };
    if (d.id) {
      const r = await db.client.updateMany({ where: { id: d.id, shopId: ctx.shop.id }, data });
      if (!r.count) throw new ActionError('Cliente não encontrado.');
      return { ok: true, message: 'Cliente salvo.', data: { id: d.id } };
    }
    const created = await db.$transaction(async (tx) => tx.client.create({ data: { ...data, shopId: ctx.shop.id, referralCode: await uniqueReferralCode(tx) } }));
    return { ok: true, message: 'Cliente cadastrado.', data: { id: created.id } };
  });
}

export async function adjustStampsAction(clientId: string, delta: number): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('loyalty');
    const client = await db.client.findFirst({ where: { id: clientId, shopId: ctx.shop.id } });
    if (!client) throw new ActionError('Cliente não encontrado.');
    if (client.stamps + delta < 0) throw new ActionError('O cliente não tem selos suficientes.');
    await db.$transaction([
      db.client.update({ where: { id: client.id }, data: { stamps: { increment: delta } } }),
      db.loyaltyEvent.create({ data: { shopId: ctx.shop.id, clientId: client.id, delta, reason: 'ADJUST' } }),
    ]);
    return { ok: true, message: 'Selos atualizados.' };
  });
}
