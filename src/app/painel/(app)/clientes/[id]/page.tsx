import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { stampsToReward } from '@/lib/domain/loyalty';
import { formatBRL } from '@/lib/domain/money';
import { formatPhone, whatsappLink } from '@/lib/domain/phone';
import { formatDateBR, minuteToHHMM, utcToZoned } from '@/lib/domain/time';
import { Page } from '@/components/dashboard/Topbar';
import { ButtonLink, Card, EmptyState, KpiCard, StatusBadge } from '@/components/ui/basic';
import { CopyButton } from '@/components/ui/interactive';
import { env } from '@/lib/env';
import { canMember, memberName, requireMember } from '@/server/context';
import { EditClientButton, StampButtons } from '../client';

export const metadata = { title: 'Cliente' };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMember('clients');
  const client = await db.client.findFirst({
    where: { id, shopId: ctx.shop.id },
    include: {
      appointments: { include: { services: true, professional: { include: { user: { select: { name: true } } } } }, orderBy: { startsAt: 'desc' }, take: 100 },
      referredBy: { select: { id: true, name: true } },
      referrals: { select: { id: true, name: true } },
    },
  });
  if (!client) notFound();
  const tz = ctx.shop.timezone;
  const spent = await db.sale.aggregate({ where: { clientId: client.id }, _sum: { totalCents: true } });
  const completed = client.appointments.filter((a) => a.status === 'COMPLETED').length;
  const noShows = client.appointments.filter((a) => a.status === 'NO_SHOW').length;
  const loyaltyCfg = { enabled: ctx.shop.loyaltyEnabled, stampsRequired: ctx.shop.loyaltyStampsRequired };
  const refLink = `${env.appUrl}/${ctx.shop.slug}?ref=${client.referralCode}`;

  return (
    <Page
      title={client.name}
      icon="user"
      actions={
        <>
          <ButtonLink href={whatsappLink(client.phone)} variant="ghost" icon="whatsapp" target="_blank">
            WhatsApp
          </ButtonLink>
          <EditClientButton
            client={{ id: client.id, name: client.name, phone: formatPhone(client.phone), email: client.email ?? '', birthDate: client.birthDate?.toISOString().slice(0, 10) ?? '', notes: client.notes ?? '' }}
          />
        </>
      }
    >
      <div className="kpi-grid">
        <KpiCard label="Atendimentos" value={completed} icon="check-circle" color="var(--success-text)" />
        <KpiCard label="Total gasto" value={formatBRL(spent._sum.totalCents ?? 0)} icon="wallet" color="var(--success-text)" />
        <KpiCard label="Faltas" value={noShows} icon="user-x" color="var(--danger-text)" />
        <KpiCard label="Selos" sub={loyaltyCfg.enabled ? `Faltam ${stampsToReward(client.stamps, loyaltyCfg)} para o prêmio` : 'Fidelidade desligada'} value={client.stamps} icon="purchase-tag" color="var(--brand-text)" />
      </div>
      <div className="grid-main-aside">
        <Card title="Histórico de agendamentos">
          {client.appointments.length === 0 ? (
            <EmptyState title="Nenhum agendamento" />
          ) : (
            <ul className="list-plain">
              {client.appointments.map((a) => {
                const z = utcToZoned(a.startsAt, tz);
                return (
                  <li key={a.id} className="list-item">
                    <span className="time-pill">{formatDateBR(z.date).slice(0, 5)}</span>
                    <div className="grow">
                      <div className="strong">{a.services.map((s) => s.name).join(' + ')}</div>
                      <div className="muted xs">
                        {formatDateBR(z.date)} às {minuteToHHMM(z.minute)} · {memberName(a.professional)} · {formatBRL(a.totalPriceCents)}
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <div className="stack">
          <Card title="Dados">
            <div className="stack-sm sm-text">
              <div className="row-between"><span className="muted">Telefone</span><span>{formatPhone(client.phone)}</span></div>
              <div className="row-between"><span className="muted">E-mail</span><span>{client.email ?? '—'}</span></div>
              <div className="row-between"><span className="muted">Aniversário</span><span>{client.birthDate ? formatDateBR(client.birthDate.toISOString().slice(0, 10)).slice(0, 5) : '—'}</span></div>
              <div className="row-between"><span className="muted">Cliente desde</span><span>{formatDateBR(utcToZoned(client.createdAt, tz).date)}</span></div>
              <div className="row-between"><span className="muted">Conta no app</span><span>{client.userId ? 'Sim' : 'Não'}</span></div>
              {client.notes ? <p style={{ marginTop: 8 }}>“{client.notes}”</p> : null}
            </div>
          </Card>
          {ctx.shop.loyaltyEnabled && canMember(ctx, 'loyalty') ? (
            <Card title="Fidelidade" actions={<StampButtons clientId={client.id} />}>
              <p className="sm-text">
                {client.stamps} de {ctx.shop.loyaltyStampsRequired} selos para {ctx.shop.loyaltyReward}.
              </p>
            </Card>
          ) : null}
          {ctx.shop.referralEnabled ? (
            <Card title="Indicação">
              <div className="stack-sm sm-text">
                <div className="row-between">
                  <span>
                    Código <span className="strong">{client.referralCode}</span>
                  </span>
                  <CopyButton text={refLink} label="Copiar link" />
                </div>
                {client.referredBy ? (
                  <span className="muted">
                    Indicado por <Link href={`/painel/clientes/${client.referredBy.id}`}>{client.referredBy.name}</Link>
                  </span>
                ) : null}
                {client.referrals.length ? <span className="muted">Indicou: {client.referrals.map((r) => r.name).join(', ')}</span> : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
