import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { formatDateBR, utcToZoned } from '@/lib/domain/time';
import { Page } from '@/components/dashboard/Topbar';
import { Button, Card, EmptyState, KpiCard, Stars } from '@/components/ui/basic';
import { memberForAction, requireMember } from '@/server/context';

export const metadata = { title: 'Avaliações' };

async function toggleHidden(form: FormData) {
  'use server';
  const ctx = await memberForAction('settings');
  await db.review.updateMany({ where: { id: String(form.get('id')), shopId: ctx.shop.id }, data: { hidden: form.get('hidden') === '1' } });
  revalidatePath('/painel/avaliacoes');
}

async function toggleShow(form: FormData) {
  'use server';
  const ctx = await memberForAction('settings');
  await db.shop.update({ where: { id: ctx.shop.id }, data: { showReviews: form.get('show') === '1' } });
  revalidatePath('/painel/avaliacoes');
}

export default async function ReviewsPage() {
  const ctx = await requireMember('settings');
  const reviews = await db.review.findMany({ where: { shopId: ctx.shop.id }, include: { client: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  const visible = reviews.filter((r) => !r.hidden);
  const avg = visible.length ? visible.reduce((s, r) => s + r.rating, 0) / visible.length : 0;
  return (
    <Page title="Avaliações" icon="star" badge={`${reviews.length}`}>
      <div className="kpi-grid">
        <KpiCard label="Nota média" value={avg ? avg.toFixed(1).replace('.', ',') : '—'} icon="star" color="var(--warning-text)" />
        <KpiCard label="Avaliações" value={reviews.length} icon="chat" color="var(--brand-text)" />
      </div>
      <Card title="Na página da loja">
        <form action={toggleShow} className="row-between">
          <span className="sm-text">{ctx.shop.showReviews ? 'As avaliações aparecem na sua página pública.' : 'As avaliações estão escondidas da sua página.'}</span>
          <input type="hidden" name="show" value={ctx.shop.showReviews ? '0' : '1'} />
          <Button type="submit" variant="ghost" size="sm">
            {ctx.shop.showReviews ? 'Esconder da página' : 'Mostrar na página'}
          </Button>
        </form>
      </Card>
      {reviews.length === 0 ? (
        <EmptyState icon="star" title="Nenhuma avaliação ainda" text="Só avalia quem teve um atendimento concluído. O pedido sai pelo WhatsApp depois do atendimento." />
      ) : (
        <Card>
          {reviews.map((r) => (
            <div key={r.id} className="review-item" style={{ opacity: r.hidden ? 0.55 : 1 }}>
              <div className="row-between">
                <div className="row">
                  <span className="strong">{r.client.name}</span>
                  <Stars rating={r.rating} />
                  <span className="muted xs">{formatDateBR(utcToZoned(r.createdAt, ctx.shop.timezone).date)}</span>
                </div>
                <form action={toggleHidden}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="hidden" value={r.hidden ? '0' : '1'} />
                  <Button type="submit" size="sm" variant="ghost" icon={r.hidden ? 'show' : 'hide'}>
                    {r.hidden ? 'Mostrar' : 'Ocultar'}
                  </Button>
                </form>
              </div>
              {r.comment ? <p className="sm-text" style={{ marginTop: 4 }}>{r.comment}</p> : null}
            </div>
          ))}
        </Card>
      )}
    </Page>
  );
}
