import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { clientCanCancel } from '@/lib/domain/appointment-status';
import { formatBRL } from '@/lib/domain/money';
import { whatsappLink } from '@/lib/domain/phone';
import { formatDateBR, minuteToHHMM, utcToZoned, weekdayLong } from '@/lib/domain/time';
import { Card, StatusBadge } from '@/components/ui/basic';
import { Icon } from '@/components/ui/Icon';
import { PublicHeader } from '@/components/public/PublicHeader';
import { CancelButton, ReviewForm } from './client';

export const metadata = { title: 'Meu agendamento', robots: { index: false } };

export default async function AppointmentLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appt = await db.appointment.findUnique({
    where: { publicToken: token },
    include: { shop: true, services: true, client: true, review: true, professional: { include: { user: { select: { name: true } } } } },
  });
  if (!appt) notFound();
  const z = utcToZoned(appt.startsAt, appt.shop.timezone);
  const canCancel = clientCanCancel(appt.status, appt.startsAt, new Date());
  const reviewed = appt.review ?? (await db.review.findFirst({ where: { shopId: appt.shopId, clientId: appt.clientId } }));
  return (
    <>
      <PublicHeader />
      <main className="public-narrow stack">
        <Card>
          <div className="stack">
            <div className="row-between">
              <div>
                <p className="eyebrow">{appt.shop.name}</p>
                <h1 className="section-title" style={{ marginTop: 4 }}>
                  {weekdayLong(z.date)}, {formatDateBR(z.date)} às {minuteToHHMM(z.minute)}
                </h1>
              </div>
              <StatusBadge status={appt.status} />
            </div>
            <div className="stack-sm sm-text">
              {appt.services.map((s) => (
                <div key={s.id} className="bp-summary-row">
                  <span>{s.name}</span>
                  <span>{formatBRL(s.priceCents)}</span>
                </div>
              ))}
              <div className="bp-summary-row"><span className="muted">Profissional</span><span>{appt.professional.displayName || appt.professional.user.name}</span></div>
              <div className="bp-summary-total"><span>Total</span><span>{formatBRL(appt.totalPriceCents)}</span></div>
            </div>
            {appt.status === 'PENDING' ? <p className="muted sm-text">Aguardando a loja confirmar. Você recebe o aviso no WhatsApp.</p> : null}
            {appt.shop.addressLine ? (
              <a className="row sm-text" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${appt.shop.name} ${appt.shop.addressLine} ${appt.shop.city ?? ''}`)}`} target="_blank" rel="noreferrer">
                <Icon name="map-pin" size={16} /> {appt.shop.addressLine}{appt.shop.city ? `, ${appt.shop.city}` : ''}
              </a>
            ) : null}
            <div className="row">
              {canCancel ? <CancelButton token={token} /> : null}
              {appt.shop.phone ? (
                <a className="btn btn-ghost" href={whatsappLink(appt.shop.phone)} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" size={16} /> Falar com a loja
                </a>
              ) : null}
              <Link className="btn btn-ghost" href={`/${appt.shop.slug}`}>
                Agendar outro horário
              </Link>
            </div>
          </div>
        </Card>
        {appt.status === 'COMPLETED' ? (
          <Card title={reviewed ? 'Obrigado pela avaliação!' : 'Como foi o atendimento?'}>
            {reviewed ? <p className="muted sm-text">Sua avaliação ajuda outros clientes a escolher.</p> : <ReviewForm token={token} />}
          </Card>
        ) : null}
      </main>
    </>
  );
}
