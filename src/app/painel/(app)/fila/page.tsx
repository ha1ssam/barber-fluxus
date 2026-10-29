import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { formatPhone, whatsappLink } from '@/lib/domain/phone';
import { formatDateBR, todayIn } from '@/lib/domain/time';
import { Page } from '@/components/dashboard/Topbar';
import { Button, ButtonLink, EmptyState } from '@/components/ui/basic';
import { canMember, memberForAction, memberName, requireMember } from '@/server/context';

export const metadata = { title: 'Fila de espera' };

async function removeEntry(form: FormData) {
  'use server';
  const ctx = await memberForAction('agenda.own');
  await db.waitlistEntry.updateMany({ where: { id: String(form.get('id')), shopId: ctx.shop.id }, data: { status: 'CANCELLED' } });
  revalidatePath('/painel/fila');
}

const STATUS: Record<string, string> = { WAITING: 'Aguardando', NOTIFIED: 'Avisado' };

export default async function WaitlistPage() {
  const ctx = await requireMember('agenda.own');
  const today = todayIn(ctx.shop.timezone);
  const all = canMember(ctx, 'agenda.all');
  const entries = await db.waitlistEntry.findMany({
    where: { shopId: ctx.shop.id, date: { gte: today }, status: { in: ['WAITING', 'NOTIFIED'] }, ...(all ? {} : { OR: [{ professionalId: ctx.membership.id }, { professionalId: null }] }) },
    include: { client: true, professional: { include: { user: { select: { name: true } } } } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  const services = await db.service.findMany({ where: { shopId: ctx.shop.id }, select: { id: true, name: true } });
  const position = new Map<string, number>();
  return (
    <Page title="Fila de espera" icon="list-ul" badge={`${entries.length}`}>
      <p className="muted sm-text">Quando um horário vaga (cancelamento ou remarcação), os 3 primeiros da fila daquele dia recebem um aviso no WhatsApp.</p>
      {entries.length === 0 ? (
        <EmptyState icon="list-ul" title="Ninguém na fila" text="Quando o dia que o cliente quer está cheio, ele pode entrar na fila pela sua página." />
      ) : (
        <div className="table-wrap">
          <table className="fx-table responsive">
            <thead>
              <tr>
                <th>Dia</th>
                <th className="num">Posição</th>
                <th>Cliente</th>
                <th>Serviços</th>
                <th>Profissional</th>
                <th>Status</th>
                <th className="num">Ações</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const pos = (position.get(e.date) ?? 0) + 1;
                position.set(e.date, pos);
                return (
                  <tr key={e.id}>
                    <td data-label="Dia" className="strong">{formatDateBR(e.date)}</td>
                    <td data-label="Posição" className="num">{pos}º</td>
                    <td data-label="Cliente">
                      <div className="strong">{e.client.name}</div>
                      <div className="muted xs">{formatPhone(e.client.phone)}</div>
                    </td>
                    <td data-label="Serviços" className="xs">{e.serviceIds.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean).join(' + ') || '—'}</td>
                    <td data-label="Profissional">{e.professional ? memberName(e.professional) : 'Qualquer um'}</td>
                    <td data-label="Status">
                      <span className={`chip ${e.status === 'NOTIFIED' ? 'success' : 'warning'}`}>{STATUS[e.status]}</span>
                    </td>
                    <td className="actions num">
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <ButtonLink href={whatsappLink(e.client.phone, `Olá, ${e.client.name.split(' ')[0]}! Abriu um horário em ${formatDateBR(e.date)} na ${ctx.shop.name}.`)} size="sm" variant="ghost" icon="whatsapp" target="_blank">
                          Chamar
                        </ButtonLink>
                        <form action={removeEntry}>
                          <input type="hidden" name="id" value={e.id} />
                          <Button type="submit" size="sm" variant="ghost" icon="x">
                            Tirar
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
