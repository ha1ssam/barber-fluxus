'use server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ActionError, memberForAction, runAction, type ActionResult } from '@/server/context';

const schema = z.object({ id: z.string().optional(), name: z.string().trim().min(2, 'Informe o nome.').max(60), priceCents: z.number().int().min(0), active: z.boolean() });

export async function saveProductAction(raw: z.input<typeof schema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('products', 'cash');
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const { id, ...data } = parsed.data;
    if (id) {
      const r = await db.product.updateMany({ where: { id, shopId: ctx.shop.id }, data });
      if (!r.count) throw new ActionError('Produto não encontrado.');
    } else await db.product.create({ data: { ...data, shopId: ctx.shop.id } });
    return { ok: true, message: 'Produto salvo.' };
  });
}
