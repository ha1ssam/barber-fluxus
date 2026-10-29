import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { formatPhone } from '@/lib/domain/phone';
import { todayIn, utcToZoned, formatDateBR, addDays, zonedToUtc } from '@/lib/domain/time';
import { Page } from '@/components/dashboard/Topbar';
import { EmptyState } from '@/components/ui/basic';
import { requireMember } from '@/server/context';
import { ClientFilters, NewClientButton } from './client';

export const metadata = { title: 'Clientes' };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string; ordem?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireMember('clients');
  const tz = ctx.shop.timezone;
  const today = todayIn(tz);
  const q = sp.q?.trim() ?? '';
  const digits = q.replace(/\D/g, '');
  const where: Prisma.ClientWhereInput = {
    shopId: ctx.shop.id,
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] } : {}),
    ...(sp.filtro === 'com-email' ? { email: { not: null } } : {}),
    ...(sp.filtro === 'sem-email' ? { email: null } : {}),
    ...(sp.filtro === 'sumidos'
      ? {
          appointments: { some: { status: 'COMPLETED' }, none: { OR: [{ status: 'COMPLETED', startsAt: { gte: zonedToUtc(addDays(today, -ctx.shop.winbackDays), 0, tz) } }, { status: { in: ['PENDING', 'CONFIRMED'] } }] } },
        }
      : {}),
  };
  const orderBy: Prisma.ClientOrderByWithRelationInput =
    sp.ordem === 'recentes' ? { createdAt: 'desc' } : sp.ordem === 'agendamentos' ? { appointments: { _count: 'desc' } } : { name: 'asc' };
  let clients = await db.client.findMany({
    where,
    orderBy,
    take: 500,
    include: {
      _count: { select: { appointments: true } },
      appointments: { where: { status: 'COMPLETED' }, orderBy: { startsAt: 'desc' }, take: 1, select: { startsAt: true } },
    },
  });
  if (sp.filtro === 'aniversariantes') clients = clients.filter((c) => c.birthDate && c.birthDate.toISOString().slice(5, 7) === today.slice(5, 7));
  const total = await db.client.count({ where: { shopId: ctx.shop.id } });

  return (
    <Page title="Clientes" icon="group" badge={`${total}`} actions={<NewClientButton />}>
      <ClientFilters values={{ q, filtro: sp.filtro ?? '', ordem: sp.ordem ?? 'nome' }} winbackDays={ctx.shop.winbackDays} />
      {clients.length === 0 ? (
        <EmptyState icon="group" title={q || sp.filtro ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'} text={q || sp.filtro ? 'Tente outra busca ou filtro.' : 'O cliente entra aqui sozinho no primeiro agendamento.'} />
      ) : (
        <div className="table-wrap">
          <table className="fx-table responsive">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th className="num">Agendamentos</th>
                <th>Última visita</th>
                <th className="num">Selos</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td data-label="Nome">
                    <Link href={`/painel/clientes/${c.id}`} className="strong">
                      {c.name}
                    </Link>
                    {c.notes ? <div className="muted xs">{c.notes}</div> : null}
                  </td>
                  <td className="nowrap" data-label="Telefone">{formatPhone(c.phone)}</td>
                  <td data-label="E-mail">{c.email ?? <span className="muted">—</span>}</td>
                  <td className="num" data-label="Agendamentos">{c._count.appointments}</td>
                  <td data-label="Última visita">{c.appointments[0] ? formatDateBR(utcToZoned(c.appointments[0].startsAt, tz).date) : <span className="muted">—</span>}</td>
                  <td className="num" data-label="Selos">{c.stamps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
