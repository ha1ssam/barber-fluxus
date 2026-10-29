import 'server-only';
import { randomInt } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { generateReferralCode } from '@/lib/domain/loyalty';

export interface ClientInput {
  name: string;
  phone: string; // já normalizado
  email?: string | null;
  userId?: string | null;
  birthDate?: Date | null;
  referralCode?: string | null;
}

async function uniqueReferralCode(tx: Prisma.TransactionClient) {
  for (let i = 0; i < 8; i++) {
    const code = generateReferralCode(() => randomInt(0, 1_000_000) / 1_000_000);
    if (!(await tx.client.findUnique({ where: { referralCode: code } }))) return code;
  }
  throw new Error('Não foi possível gerar código de indicação.');
}

/**
 * Um cadastro de cliente por loja, identificado pelo telefone (não pelo nome, como no Fluxus).
 * Liga à conta do cliente quando ele está logado.
 */
export async function findOrCreateClient(tx: Prisma.TransactionClient, shopId: string, input: ClientInput) {
  const existing = await tx.client.findUnique({ where: { shopId_phone: { shopId, phone: input.phone } } });
  if (existing) {
    const data: Prisma.ClientUpdateInput = {};
    if (input.userId && !existing.userId) data.user = { connect: { id: input.userId } };
    if (input.email && !existing.email) data.email = input.email;
    if (input.birthDate && !existing.birthDate) data.birthDate = input.birthDate;
    return Object.keys(data).length ? tx.client.update({ where: { id: existing.id }, data }) : existing;
  }
  let referredById: string | null = null;
  if (input.referralCode) {
    const ref = await tx.client.findUnique({ where: { referralCode: input.referralCode.trim().toUpperCase() } });
    if (ref && ref.shopId === shopId) referredById = ref.id;
  }
  return tx.client.create({
    data: {
      shopId,
      name: input.name.trim(),
      phone: input.phone,
      email: input.email || null,
      birthDate: input.birthDate ?? null,
      userId: input.userId ?? null,
      referralCode: await uniqueReferralCode(tx),
      referredById,
    },
  });
}

export { uniqueReferralCode };
