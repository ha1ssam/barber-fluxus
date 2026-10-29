import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { BUSINESS_LABELS, UFS } from '@/lib/domain/labels';
import { formatBRL } from '@/lib/domain/money';
import { EmptyState, initials } from '@/components/ui/basic';
import { Icon } from '@/components/ui/Icon';
import { PublicHeader } from '@/components/public/PublicHeader';

export const metadata = { title: 'Explorar barbearias', description: 'Encontre barbearias e salões perto de você e agende online.' };

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ uf?: string; cidade?: string; q?: string }> }) {
  const sp = await searchParams;
  const uf = sp.uf && UFS.includes(sp.uf) ? sp.uf : undefined;
  const now = new Date();
  // Só aparecem lojas com endereço, serviços e assinatura válida.
  const where: Prisma.ShopWhereInput = {
    listedInExplore: true,
    addressLine: { not: null },
    city: { not: null },
    services: { some: { active: true } },
    subscription: { OR: [{ status: 'TRIALING', trialEndsAt: { gt: now } }, { status: { in: ['ACTIVE', 'CANCELED'] }, currentPeriodEnd: { gt: now } }] },
    ...(uf ? { state: uf } : {}),
    ...(sp.cidade ? { city: { contains: sp.cidade.trim(), mode: 'insensitive' } } : {}),
    ...(sp.q ? { name: { contains: sp.q.trim(), mode: 'insensitive' } } : {}),
  };
  const shops = await db.shop.findMany({
    where,
    take: 50,
    orderBy: { name: 'asc' },
    include: { services: { where: { active: true }, select: { priceCents: true } }, _count: { select: { reviews: true } } },
  });
  const ratings = await db.review.groupBy({ by: ['shopId'], where: { shopId: { in: shops.map((s) => s.id) }, hidden: false }, _avg: { rating: true } });

  return (
    <>
      <PublicHeader />
      <main className="public-main stack-lg">
        <div>
          <h1 className="section-title" style={{ fontSize: 24 }}>Encontre onde cortar</h1>
          <p className="muted">Barbearias e salões com agendamento online.</p>
        </div>
        <form className="toolbar" method="get">
          <div className="field">
            <label className="field-label" htmlFor="uf">Estado</label>
            <select id="uf" name="uf" className="form-input" defaultValue={uf ?? ''}>
              <option value="">Todos</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cidade">Cidade</label>
            <input id="cidade" name="cidade" className="form-input" defaultValue={sp.cidade ?? ''} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="q">Nome</label>
            <input id="q" name="q" className="form-input" defaultValue={sp.q ?? ''} />
          </div>
          <button className="btn btn-primary" type="submit"><Icon name="search" size={16} /> Buscar</button>
        </form>
        {shops.length === 0 ? (
          <EmptyState icon="store-alt" title="Nenhuma loja encontrada" text="Tente outra cidade ou tire os filtros." />
        ) : (
          <div className="shop-grid">
            {shops.map((s) => {
              const r = ratings.find((x) => x.shopId === s.id)?._avg.rating;
              const min = Math.min(...s.services.map((x) => x.priceCents));
              return (
                <Link key={s.id} href={`/${s.slug}`} className="shop-card">
                  <div className="shop-card-cover" style={s.coverUrl ? { backgroundImage: `url(${s.coverUrl})` } : undefined} />
                  <div className="shop-card-body">
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <div className="fx-avatar" style={{ marginTop: -36, border: '3px solid var(--surface-raised)', width: 48, height: 48 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {s.logoUrl ? <img src={s.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.name)}
                      </div>
                    </div>
                    <span className="strong">{s.name}</span>
                    <span className="muted xs">{BUSINESS_LABELS[s.businessType]} · {s.neighborhood ? `${s.neighborhood}, ` : ''}{s.city} - {s.state}</span>
                    <div className="row xs">
                      {r ? <span className="chip warning"><Icon name="star-solid" size={12} /> {r.toFixed(1).replace('.', ',')} ({s._count.reviews})</span> : null}
                      <span className="chip">A partir de {formatBRL(min)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
