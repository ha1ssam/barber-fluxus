import 'server-only';
import type { BusinessType } from '@prisma/client';
import { db } from '@/lib/db';
import { normalizeCpf } from '@/lib/domain/cpf';
import { TRIAL_DAYS } from '@/lib/domain/plans';
import { isValidSlug, slugify } from '@/lib/domain/slug';

export async function availableSlug(name: string): Promise<string> {
  let base = slugify(name) || 'minha-loja';
  if (base.length < 3) base = `${base}-loja`;
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (!isValidSlug(candidate)) continue;
    if (!(await db.shop.findUnique({ where: { slug: candidate } }))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// Expediente inicial: terça a sábado, 9h–12h e 13h–19h (o dono ajusta em Configurações).
const DEFAULT_HOURS = [2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, startMinute: 9 * 60, endMinute: 12 * 60 },
  { weekday, startMinute: 13 * 60, endMinute: 19 * 60 },
]);

/**
 * Cria a loja com o dono, o teste de 7 dias e o expediente padrão.
 * Antifraude: CPF ou IP que já usaram teste começam com o teste vencido.
 */
export async function createShopForOwner(input: { userId: string; name: string; businessType: BusinessType; cpf?: string | null; ip?: string | null; now?: Date }) {
  const now = input.now ?? new Date();
  const cpf = input.cpf ? normalizeCpf(input.cpf) : null;
  const usedTrial = await db.trialTracker.findFirst({
    where: { OR: [...(cpf ? [{ cpf }] : []), ...(input.ip && input.ip !== '0.0.0.0' && input.ip !== '::1' && input.ip !== '127.0.0.1' ? [{ ip: input.ip }] : [])] },
  });
  const slug = await availableSlug(input.name);
  const shop = await db.shop.create({
    data: {
      name: input.name.trim(),
      slug,
      businessType: input.businessType,
      paymentMethods: ['cash', 'pix', 'credit', 'debit'],
      memberships: { create: { userId: input.userId, role: 'OWNER', isProfessional: true, workingHours: { create: DEFAULT_HOURS } } },
      subscription: {
        create: {
          plan: 'equipe',
          status: 'TRIALING',
          trialEndsAt: usedTrial ? now : new Date(now.getTime() + TRIAL_DAYS * 86_400_000),
        },
      },
      whatsapp: { create: {} },
    },
  });
  if (!usedTrial) await db.trialTracker.create({ data: { shopId: shop.id, cpf, ip: input.ip ?? null } });
  return { shop, trialGranted: !usedTrial };
}
