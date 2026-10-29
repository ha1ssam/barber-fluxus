import 'server-only';
import { db } from '@/lib/db';
import { addDays, addMonths, dayRangeUtc, startOfMonth, startOfWeek, utcToZoned, zonedToUtc } from '@/lib/domain/time';

async function revenue(shopId: string, start: Date, end: Date, professionalId?: string | null) {
  if (professionalId) {
    const r = await db.saleItem.aggregate({ where: { professionalId, sale: { shopId, createdAt: { gte: start, lt: end } } }, _sum: { totalCents: true } });
    return r._sum.totalCents ?? 0;
  }
  const r = await db.sale.aggregate({ where: { shopId, createdAt: { gte: start, lt: end } }, _sum: { totalCents: true } });
  return r._sum.totalCents ?? 0;
}

export async function dashboardStats(shop: { id: string; timezone: string }, today: string, professionalId: string | null, now = new Date()) {
  const tz = shop.timezone;
  const day = dayRangeUtc(today, tz);
  const week = { start: zonedToUtc(startOfWeek(today), 0, tz), end: zonedToUtc(addDays(startOfWeek(today), 7), 0, tz) };
  const month = { start: zonedToUtc(startOfMonth(today), 0, tz), end: zonedToUtc(addMonths(today, 1), 0, tz) };
  const pro = professionalId ? { professionalId } : {};

  const [todayAppts, revToday, revWeek, revMonth, pending, noShows, cancels, clients, next7, rating, reviews, monthCount] = await Promise.all([
    db.appointment.findMany({
      where: { shopId: shop.id, ...pro, startsAt: { gte: day.start, lt: day.end }, status: { not: 'CANCELLED' } },
      include: { client: true, services: true, professional: { include: { user: { select: { name: true } } } } },
      orderBy: { startsAt: 'asc' },
    }),
    revenue(shop.id, day.start, day.end, professionalId),
    revenue(shop.id, week.start, week.end, professionalId),
    revenue(shop.id, month.start, month.end, professionalId),
    db.appointment.count({ where: { shopId: shop.id, ...pro, status: 'PENDING', startsAt: { gte: now } } }),
    db.appointment.count({ where: { shopId: shop.id, ...pro, status: 'NO_SHOW', startsAt: { gte: month.start, lt: month.end } } }),
    db.appointment.count({ where: { shopId: shop.id, ...pro, status: 'CANCELLED', startsAt: { gte: month.start, lt: month.end } } }),
    db.client.count({ where: { shopId: shop.id } }),
    db.appointment.count({ where: { shopId: shop.id, ...pro, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gte: now, lt: new Date(now.getTime() + 7 * 86_400_000) } } }),
    db.review.aggregate({ where: { shopId: shop.id, hidden: false }, _avg: { rating: true }, _count: true }),
    db.review.findMany({ where: { shopId: shop.id }, include: { client: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 3 }),
    db.appointment.count({ where: { shopId: shop.id, startsAt: { gte: month.start, lt: month.end }, status: { not: 'CANCELLED' } } }),
  ]);
  return { todayAppts, revToday, revWeek, revMonth, pending, noShows, cancels, clients, next7, rating: rating._avg.rating, ratingCount: rating._count, reviews, monthCount };
}

export type ReportPeriod = 'week' | 'month' | 'year';

function periodRange(period: ReportPeriod, today: string, offset: number) {
  if (period === 'week') {
    const s = addDays(startOfWeek(today), 7 * offset);
    return { from: s, to: addDays(s, 7) };
  }
  if (period === 'month') {
    const s = addMonths(startOfMonth(today), offset);
    return { from: s, to: addMonths(s, 1) };
  }
  const y = Number(today.slice(0, 4)) + offset;
  return { from: `${y}-01-01`, to: `${y + 1}-01-01` };
}

async function periodNumbers(shopId: string, tz: string, from: string, to: string) {
  const start = zonedToUtc(from, 0, tz);
  const end = zonedToUtc(to, 0, tz);
  const [sales, statusCounts, newClients, totalClients] = await Promise.all([
    db.sale.findMany({ where: { shopId, createdAt: { gte: start, lt: end } }, select: { totalCents: true, createdAt: true, appointmentId: true } }),
    db.appointment.groupBy({ by: ['status'], where: { shopId, startsAt: { gte: start, lt: end } }, _count: true }),
    db.client.count({ where: { shopId, createdAt: { gte: start, lt: end } } }),
    db.client.count({ where: { shopId, createdAt: { lt: end } } }),
  ]);
  const count = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const revenueCents = sales.reduce((s, x) => s + x.totalCents, 0);
  const completed = count('COMPLETED');
  const noShow = count('NO_SHOW');
  return {
    start,
    end,
    sales,
    revenueCents,
    completed,
    cancelled: count('CANCELLED'),
    noShow,
    ticketCents: sales.length ? Math.round(revenueCents / sales.length) : 0,
    attendanceRate: completed + noShow > 0 ? completed / (completed + noShow) : null,
    newClients,
    totalClients,
  };
}

export async function reportData(shop: { id: string; timezone: string }, period: ReportPeriod, today: string) {
  const cur = periodRange(period, today, 0);
  const prev = periodRange(period, today, -1);
  const [current, previous] = await Promise.all([periodNumbers(shop.id, shop.timezone, cur.from, cur.to), periodNumbers(shop.id, shop.timezone, prev.from, prev.to)]);

  // Faturamento por dia (ou por mês no ano)
  const buckets = new Map<string, number>();
  if (period === 'year') for (let m = 1; m <= 12; m++) buckets.set(`${cur.from.slice(0, 4)}-${String(m).padStart(2, '0')}`, 0);
  else for (let d = cur.from; d < cur.to; d = addDays(d, 1)) buckets.set(d, 0);
  for (const s of current.sales) {
    const local = utcToZoned(s.createdAt, shop.timezone).date;
    const key = period === 'year' ? local.slice(0, 7) : local;
    buckets.set(key, (buckets.get(key) ?? 0) + s.totalCents);
  }

  const [topServices, hourly, byPro] = await Promise.all([
    db.saleItem.groupBy({
      by: ['description'],
      where: { kind: 'SERVICE', sale: { shopId: shop.id, createdAt: { gte: current.start, lt: current.end } } },
      _sum: { totalCents: true },
      _count: true,
      orderBy: { _sum: { totalCents: 'desc' } },
      take: 5,
    }),
    db.appointment.findMany({ where: { shopId: shop.id, status: 'COMPLETED', startsAt: { gte: current.start, lt: current.end } }, select: { startsAt: true } }),
    db.saleItem.groupBy({
      by: ['professionalId'],
      where: { sale: { shopId: shop.id, createdAt: { gte: current.start, lt: current.end } } },
      _sum: { totalCents: true },
    }),
  ]);
  const hours = new Map<number, number>();
  for (let h = 7; h <= 21; h++) hours.set(h, 0);
  for (const a of hourly) {
    const h = Math.floor(utcToZoned(a.startsAt, shop.timezone).minute / 60);
    if (hours.has(h)) hours.set(h, (hours.get(h) ?? 0) + 1);
  }
  const pros = await db.membership.findMany({ where: { id: { in: byPro.map((p) => p.professionalId).filter((x): x is string => !!x) } }, include: { user: { select: { name: true } } } });
  const ranking = byPro
    .filter((p) => p.professionalId)
    .map((p) => {
      const m = pros.find((x) => x.id === p.professionalId);
      return { name: m ? m.displayName || m.user.name : 'Profissional removido', totalCents: p._sum.totalCents ?? 0 };
    })
    .sort((a, b) => b.totalCents - a.totalCents);

  return {
    range: cur,
    current,
    previous,
    series: [...buckets.entries()].map(([key, cents]) => ({ key, cents })),
    topServices: topServices.map((t) => ({ name: t.description, count: t._count, totalCents: t._sum.totalCents ?? 0 })),
    hours: [...hours.entries()].map(([hour, count]) => ({ hour, count })),
    ranking,
  };
}
