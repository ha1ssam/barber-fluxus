import 'server-only';
import { db } from '@/lib/db';
import { todayIn } from '@/lib/domain/time';
import { canMember, type Ctx } from './context';

/** Dados que os modais de agenda precisam (serviços, profissionais que a pessoa pode operar). */
export async function scheduleOptions(ctx: Ctx) {
  const [services, pros] = await Promise.all([
    db.service.findMany({ where: { shopId: ctx.shop.id, active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, priceCents: true, durationMinutes: true } }),
    db.membership.findMany({
      where: { shopId: ctx.shop.id, active: true, isProfessional: true, ...(canMember(ctx, 'agenda.all') ? {} : { id: ctx.membership.id }) },
      include: { user: { select: { name: true } }, services: { select: { serviceId: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return {
    today: todayIn(ctx.shop.timezone),
    services,
    professionals: pros.map((p) => ({ id: p.id, name: p.displayName || p.user.name, serviceIds: p.services.map((s) => s.serviceId) })),
  };
}
