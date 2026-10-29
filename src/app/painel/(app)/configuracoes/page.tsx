import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { formatPhone } from '@/lib/domain/phone';
import { Page } from '@/components/dashboard/Topbar';
import { canMember, memberName, requireMember } from '@/server/context';
import { AccountForm, AgendaForm, HoursForm, SettingsTabs, ShopForm } from './client';

export const metadata = { title: 'Configurações' };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ aba?: string; profissional?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember();
  const isAdmin = canMember(ctx, 'settings');
  const tabs = [
    ...(isAdmin ? [{ id: 'loja', label: 'Loja', icon: 'store-alt' as const }] : []),
    { id: 'horarios', label: 'Horários', icon: 'time-five' as const },
    ...(isAdmin ? [{ id: 'agenda', label: 'Agenda', icon: 'calendar' as const }] : []),
    { id: 'conta', label: 'Minha conta', icon: 'user-circle' as const },
  ];
  const tab = tabs.some((t) => t.id === sp.aba) ? sp.aba! : tabs[0].id;
  const s = ctx.shop;

  let content: React.ReactNode = null;
  if (tab === 'loja') {
    content = (
      <ShopForm
        appUrl={env.appUrl}
        initial={{
          name: s.name,
          slug: s.slug,
          businessType: s.businessType,
          description: s.description ?? '',
          phone: s.phone ? formatPhone(s.phone) : '',
          email: s.email ?? '',
          addressLine: s.addressLine ?? '',
          neighborhood: s.neighborhood ?? '',
          city: s.city ?? '',
          state: s.state ?? '',
          zipCode: s.zipCode ?? '',
          instagram: s.instagram ?? '',
          facebook: s.facebook ?? '',
          tiktok: s.tiktok ?? '',
          logoUrl: s.logoUrl ?? '',
          coverUrl: s.coverUrl ?? '',
          paymentMethods: s.paymentMethods,
          amenities: s.amenities,
        }}
      />
    );
  } else if (tab === 'horarios') {
    const pros = isAdmin
      ? await db.membership.findMany({ where: { shopId: s.id, active: true, isProfessional: true }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } })
      : [{ ...ctx.membership, user: { name: ctx.user.name } }];
    const selected = pros.find((p) => p.id === sp.profissional) ?? pros[0];
    const hours = selected ? await db.workingHours.findMany({ where: { membershipId: selected.id }, orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] }) : [];
    content = selected ? (
      <HoursForm
        key={selected.id}
        membershipId={selected.id}
        professionals={pros.map((p) => ({ id: p.id, name: memberName(p) }))}
        canEdit={isAdmin || ctx.membership.canManageOwnSchedule}
        initial={[0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, shifts: hours.filter((h) => h.weekday === weekday).map((h) => ({ start: h.startMinute, end: h.endMinute })) }))}
      />
    ) : (
      <p className="muted">Ninguém da equipe atende clientes ainda.</p>
    );
  } else if (tab === 'agenda') {
    content = <AgendaForm initial={{ slotInterval: s.slotInterval, bufferMinutes: s.bufferMinutes, minAdvanceMinutes: s.minAdvanceMinutes, maxAdvanceDays: s.maxAdvanceDays, autoConfirm: s.autoConfirm, listedInExplore: s.listedInExplore, timezone: s.timezone }} />;
  } else {
    content = <AccountForm initial={{ name: ctx.user.name, phone: ctx.user.phone ? formatPhone(ctx.user.phone) : '', email: ctx.user.email }} hasPassword={!!ctx.user.passwordHash} isOwner={ctx.membership.role === 'OWNER'} />;
  }

  return (
    <Page title="Configurações" icon="cog">
      <SettingsTabs tabs={tabs} value={tab} />
      {content}
    </Page>
  );
}
