import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import { planState } from '@/lib/domain/plans';

export const getPublicShop = cache(async (slug: string) => {
  const shop = await db.shop.findUnique({
    where: { slug },
    include: {
      subscription: true,
      services: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      memberships: {
        where: { active: true, isProfessional: true },
        include: { user: { select: { name: true } }, services: { select: { serviceId: true } }, workingHours: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!shop) return null;
  return { ...shop, plan: planState(shop.subscription) };
});
