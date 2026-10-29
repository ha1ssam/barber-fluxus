import { db } from '@/lib/db';
import { Page } from '@/components/dashboard/Topbar';
import { canMember, listProfessionals, memberName, requireMember } from '@/server/context';
import { ServicesClient } from './client';

export const metadata = { title: 'Serviços' };

export default async function ServicesPage() {
  const ctx = await requireMember();
  const [services, pros] = await Promise.all([
    db.service.findMany({ where: { shopId: ctx.shop.id }, include: { professionals: true }, orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }] }),
    listProfessionals(ctx.shop.id),
  ]);
  return (
    <Page title="Serviços" icon="cut" badge={`${services.filter((s) => s.active).length} ativos`}>
      <ServicesClient
        canEdit={canMember(ctx, 'services.manage')}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          category: s.category,
          priceCents: s.priceCents,
          durationMinutes: s.durationMinutes,
          active: s.active,
          professionalIds: s.professionals.map((p) => p.membershipId),
        }))}
        professionals={pros.map((p) => ({ id: p.id, name: memberName(p) }))}
      />
    </Page>
  );
}
