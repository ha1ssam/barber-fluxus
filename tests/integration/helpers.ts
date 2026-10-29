import { db } from '@/lib/db';
import { createShopForOwner } from '@/server/shops';

let n = 0;

/** Loja com dono (profissional), um barbeiro, dois serviços e expediente seg–sáb 9h–12h e 13h–18h. */
export async function makeShop(opts: { autoConfirm?: boolean } = {}) {
  n++;
  const stamp = `${n}-${Date.now()}`;
  const owner = await db.user.create({ data: { name: `Dono ${n}`, email: `dono${stamp}@teste.dev` } });
  const barber = await db.user.create({ data: { name: `Barbeiro ${n}`, email: `barb${stamp}@teste.dev` } });
  const { shop } = await createShopForOwner({ userId: owner.id, name: `Loja Teste ${stamp}`, businessType: 'BARBERSHOP', ip: `10.0.${n}.1` });
  await db.shop.update({ where: { id: shop.id }, data: { autoConfirm: opts.autoConfirm ?? false, minAdvanceMinutes: 0 } });
  // Teste ativo em relação ao "agora" fixo dos testes (2030).
  await db.subscription.update({ where: { shopId: shop.id }, data: { status: 'TRIALING', trialEndsAt: new Date('2030-03-10T00:00:00Z') } });
  const ownerM = await db.membership.findFirstOrThrow({ where: { shopId: shop.id, userId: owner.id } });
  const barberM = await db.membership.create({ data: { shopId: shop.id, userId: barber.id, role: 'BARBER' } });
  const hours = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
    { weekday, startMinute: 9 * 60, endMinute: 12 * 60 },
    { weekday, startMinute: 13 * 60, endMinute: 18 * 60 },
  ]);
  await db.workingHours.deleteMany({ where: { membershipId: ownerM.id } });
  for (const m of [ownerM, barberM]) await db.workingHours.createMany({ data: hours.map((h) => ({ ...h, membershipId: m.id })) });
  const corte = await db.service.create({
    data: { shopId: shop.id, name: 'Corte', priceCents: 5000, durationMinutes: 30, professionals: { create: [{ membershipId: ownerM.id }, { membershipId: barberM.id }] } },
  });
  const barba = await db.service.create({ data: { shopId: shop.id, name: 'Barba', priceCents: 3000, durationMinutes: 30, professionals: { create: [{ membershipId: ownerM.id }] } } });
  return { shop, owner, ownerM, barberM, corte, barba };
}

// Segunda-feira 2030-03-04 em São Paulo (UTC-3). "Agora" é o domingo anterior, 12h.
export const MONDAY = '2030-03-04';
export const NOW = new Date('2030-03-03T15:00:00Z');
