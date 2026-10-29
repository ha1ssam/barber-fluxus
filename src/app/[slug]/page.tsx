import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { AMENITY_OPTIONS, BUSINESS_LABELS, CATEGORY_ICONS, PAYMENT_OPTIONS } from '@/lib/domain/labels';
import { formatPhone, whatsappLink } from '@/lib/domain/phone';
import { addDays, formatDateBR, isValidDate, minuteToHHMM, todayIn, utcToZoned, WEEKDAY_NAMES, weekdayOf } from '@/lib/domain/time';
import { initials, Stars } from '@/components/ui/basic';
import { Icon } from '@/components/ui/Icon';
import { BookingFlow } from '@/components/booking/BookingFlow';
import { getPublicShop } from '@/server/public-shop';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getPublicShop(slug);
  if (!shop) return { title: 'Loja não encontrada' };
  const desc = shop.description ?? `Agende seu horário na ${shop.name}${shop.city ? ` em ${shop.city}` : ''}.`;
  return {
    title: `${shop.name} · Agendar horário`,
    description: desc,
    openGraph: { title: shop.name, description: desc, images: shop.coverUrl ? [`${env.appUrl}${shop.coverUrl.startsWith('/') ? shop.coverUrl : ''}`] : undefined },
  };
}

export default async function ShopPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ data?: string; ref?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const shop = await getPublicShop(slug);
  if (!shop) notFound();
  const user = await getCurrentUser();
  const today = todayIn(shop.timezone);
  const [reviews, rating] = shop.showReviews
    ? await Promise.all([
        db.review.findMany({ where: { shopId: shop.id, hidden: false }, include: { client: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }),
        db.review.aggregate({ where: { shopId: shop.id, hidden: false }, _avg: { rating: true }, _count: true }),
      ])
    : [[], null];

  // Horário da loja = união do expediente dos profissionais.
  const hoursByDay = [0, 1, 2, 3, 4, 5, 6].map((wd) => {
    const shifts = shop.memberships.flatMap((m) => m.workingHours.filter((h) => h.weekday === wd));
    if (!shifts.length) return { wd, text: 'Fechado' };
    return { wd, text: `${minuteToHHMM(Math.min(...shifts.map((s) => s.startMinute)))} às ${minuteToHHMM(Math.max(...shifts.map((s) => s.endMinute)))}` };
  });
  const todayWd = weekdayOf(today);
  const acceptsBookings = shop.plan.active && shop.services.length > 0 && shop.memberships.some((m) => m.workingHours.length > 0);
  const address = [shop.addressLine, shop.neighborhood, shop.city && shop.state ? `${shop.city} - ${shop.state}` : shop.city].filter(Boolean).join(', ');
  let clientPrefill = { name: '', phone: '' };
  if (user) {
    const c = await db.client.findFirst({ where: { shopId: shop.id, userId: user.id } });
    clientPrefill = { name: c?.name ?? user.name, phone: c ? formatPhone(c.phone) : user.phone ? formatPhone(user.phone) : '' };
  }
  const initialDate = sp.data && isValidDate(sp.data) && sp.data >= today ? sp.data : undefined;

  return (
    <div className="bp">
      <header className="bp-hero" style={shop.coverUrl ? { backgroundImage: `url(${shop.coverUrl})` } : undefined}>
        <div className="bp-hero-inner">
          <div className="bp-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : initials(shop.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.8)' }}>{BUSINESS_LABELS[shop.businessType]}</p>
            <h1 className="hero-name">{shop.name}</h1>
            <div className="bp-hero-meta">
              {rating && rating._count > 0 ? (
                <span>
                  <Icon name="star-solid" size={14} /> {(rating._avg.rating ?? 0).toFixed(1).replace('.', ',')} ({rating._count})
                </span>
              ) : null}
              {address ? (
                <span>
                  <Icon name="map-pin" size={14} /> {address}
                </span>
              ) : null}
              <span>
                <Icon name="time-five" size={14} /> Hoje: {hoursByDay[todayWd].text}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="bp-body">
        <main>
          <section id="agendar" className="bp-section">
            {acceptsBookings ? (
              <BookingFlow
                slug={shop.slug}
                shopName={shop.name}
                today={today}
                maxDate={addDays(today, shop.maxAdvanceDays)}
                initialDate={initialDate}
                referralCode={sp.ref?.toUpperCase().slice(0, 12) ?? ''}
                prefill={clientPrefill}
                loggedIn={!!user}
                services={shop.services.map((s) => ({ id: s.id, name: s.name, description: s.description, priceCents: s.priceCents, durationMinutes: s.durationMinutes, icon: CATEGORY_ICONS[s.category] ?? 'cut' }))}
                professionals={shop.memberships.map((m) => ({
                  id: m.id,
                  name: m.displayName || m.user.name,
                  picture: m.pictureUrl,
                  badge: m.role === 'OWNER' ? 'Dono' : 'Profissional',
                  serviceIds: m.services.map((s) => s.serviceId),
                  weekdays: [...new Set(m.workingHours.map((h) => h.weekday))],
                }))}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-icon"><Icon name="calendar-x" size={20} /></div>
                <p className="empty-title">Agendamento online indisponível</p>
                <p className="empty-text">{shop.phone ? 'Fale com a loja pelo WhatsApp para marcar seu horário.' : 'Esta loja ainda não abriu a agenda online.'}</p>
                {shop.phone ? (
                  <a className="btn btn-primary" href={whatsappLink(shop.phone, `Olá! Quero agendar um horário na ${shop.name}.`)} target="_blank" rel="noreferrer">
                    <Icon name="whatsapp" size={16} /> Chamar no WhatsApp
                  </a>
                ) : null}
              </div>
            )}
          </section>

          <section id="servicos" className="bp-section">
            <h2 className="section-title" style={{ marginBottom: 12 }}>Serviços</h2>
            <ul className="list-plain">
              {shop.services.map((s) => (
                <li key={s.id} className="list-item">
                  <Icon name={CATEGORY_ICONS[s.category] ?? 'cut'} size={18} style={{ color: 'var(--text-secondary)' }} />
                  <div className="grow">
                    <div className="strong">{s.name}</div>
                    <div className="muted xs">{s.description ? `${s.description} · ` : ''}{s.durationMinutes} min</div>
                  </div>
                  <span className="price-text">{(s.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </li>
              ))}
            </ul>
          </section>

          {shop.showReviews && rating && rating._count > 0 ? (
            <section id="avaliacoes" className="bp-section">
              <div className="row-between" style={{ marginBottom: 8 }}>
                <h2 className="section-title">Avaliações</h2>
                <span className="row">
                  <Stars rating={rating._avg.rating ?? 0} /> <span className="strong">{(rating._avg.rating ?? 0).toFixed(1).replace('.', ',')}</span> <span className="muted xs">({rating._count})</span>
                </span>
              </div>
              {reviews.map((r) => (
                <div key={r.id} className="review-item">
                  <div className="row-between">
                    <span className="strong sm-text">{r.client.name.split(' ')[0]}</span>
                    <span className="row">
                      <Stars rating={r.rating} size={12} />
                      <span className="muted xs">{formatDateBR(utcToZoned(r.createdAt, shop.timezone).date)}</span>
                    </span>
                  </div>
                  {r.comment ? <p className="sm-text" style={{ marginTop: 4 }}>{r.comment}</p> : null}
                </div>
              ))}
            </section>
          ) : null}
        </main>

        <aside className="bp-aside">
          <div className="card stack" id="sobre">
            {shop.description ? <p className="sm-text">{shop.description}</p> : null}
            <div>
              <p className="field-label" style={{ marginBottom: 4 }}>Horários</p>
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                <div key={wd} className={`bp-hours-row ${wd === todayWd ? 'today' : ''}`}>
                  <span>{WEEKDAY_NAMES[wd]}</span>
                  <span>{hoursByDay[wd].text}</span>
                </div>
              ))}
            </div>
            {address ? (
              <a className="row sm-text" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name} ${address}`)}`} target="_blank" rel="noreferrer">
                <Icon name="map-pin" size={16} /> {address}
              </a>
            ) : null}
            {shop.paymentMethods.length ? (
              <div>
                <p className="field-label" style={{ marginBottom: 4 }}>Pagamento na loja</p>
                <div className="row">{shop.paymentMethods.map((p) => <span key={p} className="chip">{PAYMENT_OPTIONS[p] ?? p}</span>)}</div>
              </div>
            ) : null}
            {shop.amenities.length ? (
              <div>
                <p className="field-label" style={{ marginBottom: 4 }}>Comodidades</p>
                <div className="row">{shop.amenities.map((a) => <span key={a} className="chip">{AMENITY_OPTIONS[a] ?? a}</span>)}</div>
              </div>
            ) : null}
            <div className="row">
              {shop.phone ? (
                <a className="btn btn-ghost btn-sm" href={whatsappLink(shop.phone)} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" size={14} /> WhatsApp
                </a>
              ) : null}
              {shop.instagram ? (
                <a className="btn btn-ghost btn-sm" href={`https://instagram.com/${shop.instagram}`} target="_blank" rel="noreferrer">
                  <Icon name="instagram" size={14} /> Instagram
                </a>
              ) : null}
              {shop.tiktok ? (
                <a className="btn btn-ghost btn-sm" href={`https://tiktok.com/@${shop.tiktok}`} target="_blank" rel="noreferrer">
                  <Icon name="tiktok" size={14} /> TikTok
                </a>
              ) : null}
              {shop.facebook ? (
                <a className="btn btn-ghost btn-sm" href={shop.facebook.startsWith('http') ? shop.facebook : `https://facebook.com/${shop.facebook}`} target="_blank" rel="noreferrer">
                  <Icon name="facebook" size={14} /> Facebook
                </a>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
      <footer className="bp-footer">
        {user ? <a href="/meus-agendamentos">Meus agendamentos</a> : <a href={`/entrar?next=/${shop.slug}`}>Entrar</a>} · Agendamento por <a href="/">Fluxus</a>
      </footer>
    </div>
  );
}
