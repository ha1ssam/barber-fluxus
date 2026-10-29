import { db } from '@/lib/db';
import { formatBRL, formatPercent } from '@/lib/domain/money';
import { hasFeature } from '@/lib/domain/plans';
import { ROLE_LABELS } from '@/lib/domain/permissions';
import { formatDateBR, utcToZoned } from '@/lib/domain/time';
import { FeatureLocked, Page } from '@/components/dashboard/Topbar';
import { Card } from '@/components/ui/basic';
import { requireMember } from '@/server/context';
import { InviteForm, MemberRow, RevokeButton, ShopCommissionForm } from './client';

export const metadata = { title: 'Equipe' };

export default async function TeamPage() {
  const ctx = await requireMember('team');
  const teamAllowed = hasFeature(ctx.plan, 'team');
  const [members, invites] = await Promise.all([
    db.membership.findMany({ where: { shopId: ctx.shop.id, active: true }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: 'asc' } }),
    db.invitation.findMany({ where: { shopId: ctx.shop.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } }),
  ]);
  const pros = members.filter((m) => m.isProfessional).length;
  const s = ctx.shop;
  return (
    <Page title="Equipe" icon="user-plus" badge={`${pros}/${ctx.plan.effectivePlan.maxProfessionals} profissionais`}>
      {!teamAllowed ? <FeatureLocked feature="Equipe" reason={ctx.plan.active ? 'O plano Essencial tem 1 profissional. Mude para o Equipe para convidar até 5 profissionais e recepcionistas.' : ctx.plan.reason} /> : null}
      <Card title="Pessoas">
        <div className="table-wrap" style={{ border: 'none' }}>
          <table className="fx-table responsive">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Papel</th>
                <th>Atende</th>
                <th>Comissão</th>
                <th className="num">Ações</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={{
                    id: m.id,
                    name: m.displayName || m.user.name,
                    email: m.user.email,
                    displayName: m.displayName ?? '',
                    role: m.role,
                    roleLabel: ROLE_LABELS[m.role],
                    isProfessional: m.isProfessional,
                    canManageOwnSchedule: m.canManageOwnSchedule,
                    canManageOwnServices: m.canManageOwnServices,
                    commissionType: m.commissionType ?? 'DEFAULT',
                    commissionValue: m.commissionValue ?? 0,
                    commissionText: !m.commissionType
                      ? m.role === 'OWNER'
                        ? 'Dono (sem comissão)'
                        : 'Padrão da loja'
                      : m.commissionType === 'PERCENT'
                        ? formatPercent(m.commissionValue ?? 0)
                        : m.commissionType === 'FIXED'
                          ? `${formatBRL(m.commissionValue ?? 0)}/serviço`
                          : m.commissionType === 'CHAIR_RENT'
                            ? `Aluguel ${formatBRL(m.commissionValue ?? 0)}/mês`
                            : 'Sem comissão',
                  }}
                  isSelf={m.userId === ctx.user.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {teamAllowed ? (
        <div className="grid-2">
          <Card title="Convidar">
            <InviteForm />
            {invites.length ? (
              <ul className="list-plain" style={{ marginTop: 12 }}>
                {invites.map((i) => (
                  <li key={i.id} className="list-item sm-text">
                    <div className="grow">
                      <div className="strong">{i.email}</div>
                      <div className="muted xs">
                        {ROLE_LABELS[i.role]} · vence em {formatDateBR(utcToZoned(i.expiresAt, s.timezone).date)}
                      </div>
                    </div>
                    <RevokeButton id={i.id} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
          <Card title="Comissão padrão da loja">
            <ShopCommissionForm initial={{ type: s.commissionType, value: s.commissionValue, productPercent: s.productCommissionPercent }} />
          </Card>
        </div>
      ) : null}
    </Page>
  );
}
