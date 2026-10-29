import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { normalizePhone } from '@/lib/domain/phone';
import { formatBRL } from '@/lib/domain/money';
import { formatDateBR, minuteToHHMM, utcToZoned } from '@/lib/domain/time';
import { Card, EmptyState, StatusBadge } from '@/components/ui/basic';
import { PublicHeader } from '@/components/public/PublicHeader';

export const metadata = { title: 'Meus agendamentos' };

export default async function MyAppointments() {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?next=/meus-agendamentos');
  // Liga fichas de cliente antigas pelo telefone da conta (o cliente pode ter agendado sem conta antes).
  const phone = user.phone ? normalizePhone(user.phone) : null;
  if (phone) await db.client.updateMany({ where: { phone, userId: null }, data: { userId: user.id } });
  const appts = await db.appointment.findMany({
    where: { client: { userId: user.id } },
    include: { shop: true, services: true },
    orderBy: { startsAt: 'desc' },
    take: 100,
  });
  const now = new Date();
  const upcoming = appts.filter((a) => a.startsAt >= now && (a.status === 'PENDING' || a.status === 'CONFIRMED')).reverse();
  const past = appts.filter((a) => !upcoming.includes(a));
  const membership = await db.membership.findFirst({ where: { userId: user.id, active: true } });

  const Item = ({ a }: { a: (typeof appts)[number] }) => {
    const z = utcToZoned(a.startsAt, a.shop.timezone);
    return (
      <li className="list-item">
        <span className="time-pill">{formatDateBR(z.date).slice(0, 5)}</span>
        <div className="grow">
          <Link href={`/a/${a.publicToken}`} className="strong">{a.shop.name}</Link>
          <div className="muted xs">
            {minuteToHHMM(z.minute)} · {a.services.map((s) => s.name).join(' + ')} · {formatBRL(a.totalPriceCents)}
          </div>
        </div>
        <StatusBadge status={a.status} />
      </li>
    );
  };

  return (
    <>
      <PublicHeader />
      <main className="public-narrow stack">
        <div className="row-between">
          <h1 className="section-title">Olá, {user.name.split(' ')[0]}</h1>
          {membership ? <Link className="btn btn-primary btn-sm" href="/painel">Ir para o painel</Link> : <Link className="btn btn-ghost btn-sm" href="/painel/criar-loja">Tenho um negócio</Link>}
        </div>
        <Card title="Próximos horários">
          {upcoming.length === 0 ? (
            <EmptyState icon="calendar" title="Nenhum horário marcado" text="Encontre uma barbearia e agende." action={<Link className="btn btn-primary" href="/explorar">Explorar</Link>} />
          ) : (
            <ul className="list-plain">{upcoming.map((a) => <Item key={a.id} a={a} />)}</ul>
          )}
        </Card>
        {past.length ? (
          <Card title="Histórico">
            <ul className="list-plain">{past.map((a) => <Item key={a.id} a={a} />)}</ul>
          </Card>
        ) : null}
        <p className="muted xs">Para cancelar, abra o agendamento. Só aparecem aqui reservas feitas com o mesmo WhatsApp ou com esta conta.</p>
      </main>
    </>
  );
}
