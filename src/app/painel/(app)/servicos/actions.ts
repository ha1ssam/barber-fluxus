'use server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { CATEGORY_LABELS } from '@/lib/domain/labels';
import { ActionError, memberForAction, runAction, type ActionResult } from '@/server/context';

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Informe o nome do serviço.').max(60),
  description: z.string().trim().max(200).optional(),
  category: z.enum(['HAIRCUT', 'BEARD', 'EYEBROW', 'COMBO', 'HAIR', 'NAILS', 'SKIN', 'OTHER']),
  priceCents: z.number().int().min(0, 'Preço inválido.').max(10_000_00),
  durationMinutes: z
    .number()
    .int()
    .min(10, 'A duração mínima é de 10 minutos.')
    .max(8 * 60)
    .refine((v) => v % 5 === 0, 'A duração precisa ser múltipla de 5 minutos.'),
  active: z.boolean(),
  professionalIds: z.array(z.string()).min(1, 'Escolha quem faz este serviço.'),
});

export async function saveServiceAction(raw: z.input<typeof schema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('services.manage');
    if (!ctx.plan.active) throw new ActionError('Sua assinatura está inativa. Renove para cadastrar serviços.');
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const d = parsed.data;
    const pros = await db.membership.findMany({ where: { shopId: ctx.shop.id, id: { in: d.professionalIds } }, select: { id: true } });
    const data = { name: d.name, description: d.description || null, category: d.category, priceCents: d.priceCents, durationMinutes: d.durationMinutes, active: d.active };
    if (d.id) {
      const svc = await db.service.findFirst({ where: { id: d.id, shopId: ctx.shop.id } });
      if (!svc) throw new ActionError('Serviço não encontrado.');
      await db.$transaction([
        db.service.update({ where: { id: svc.id }, data }),
        db.professionalService.deleteMany({ where: { serviceId: svc.id } }),
        db.professionalService.createMany({ data: pros.map((p) => ({ serviceId: svc.id, membershipId: p.id })) }),
      ]);
      return { ok: true, message: 'Serviço salvo.' };
    }
    const count = await db.service.count({ where: { shopId: ctx.shop.id } });
    await db.service.create({ data: { ...data, shopId: ctx.shop.id, sortOrder: count, professionals: { create: pros.map((p) => ({ membershipId: p.id })) } } });
    return { ok: true, message: 'Serviço criado.' };
  });
}

export async function toggleServiceAction(id: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('services.manage');
    const r = await db.service.updateMany({ where: { id, shopId: ctx.shop.id }, data: { active } });
    if (!r.count) throw new ActionError('Serviço não encontrado.');
    return { ok: true, message: active ? 'Serviço ativado.' : 'Serviço desativado. O histórico continua salvo.' };
  });
}

export async function moveServiceAction(id: string, dir: -1 | 1): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('services.manage');
    const list = await db.service.findMany({ where: { shopId: ctx.shop.id }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true } });
    const i = list.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return { ok: true };
    [list[i], list[j]] = [list[j], list[i]];
    await db.$transaction(list.map((s, idx) => db.service.update({ where: { id: s.id }, data: { sortOrder: idx } })));
    return { ok: true };
  });
}

/**
 * Preço médio do tipo de serviço em outras lojas: cidade, depois estado, depois Brasil.
 * Só mostra com pelo menos 3 lojas para não expor o preço de uma loja específica.
 */
export async function marketPriceAction(category: string): Promise<ActionResult<{ avgCents: number; scope: string; shops: number } | null>> {
  return runAction(async () => {
    const ctx = await memberForAction();
    if (!(category in CATEGORY_LABELS)) return { ok: true, data: null };
    const scopes: { label: string; where: object }[] = [];
    if (ctx.shop.city && ctx.shop.state) scopes.push({ label: `em ${ctx.shop.city}`, where: { city: ctx.shop.city, state: ctx.shop.state } });
    if (ctx.shop.state) scopes.push({ label: `em ${ctx.shop.state}`, where: { state: ctx.shop.state } });
    scopes.push({ label: 'no Brasil', where: {} });
    for (const s of scopes) {
      const rows = await db.service.groupBy({
        by: ['shopId'],
        where: { category: category as 'HAIRCUT', active: true, shopId: { not: ctx.shop.id }, shop: s.where },
        _avg: { priceCents: true },
      });
      if (rows.length >= 3) {
        const avg = Math.round(rows.reduce((a, r) => a + (r._avg.priceCents ?? 0), 0) / rows.length);
        return { ok: true, data: { avgCents: avg, scope: s.label, shops: rows.length } };
      }
    }
    return { ok: true, data: null };
  });
}
