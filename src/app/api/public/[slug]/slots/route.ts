import { NextResponse, type NextRequest } from 'next/server';
import { sumServices } from '@/lib/domain/availability';
import { isValidDate, minuteToHHMM } from '@/lib/domain/time';
import { rateLimit } from '@/lib/rate-limit';
import { slotsFor } from '@/server/availability';
import { getPublicShop } from '@/server/public-shop';

/** Horários livres de um dia para os serviços escolhidos (um profissional ou "any"). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  if (!rateLimit(`slots:${ip}`, 120, 60_000)) return NextResponse.json({ error: 'Muitas consultas. Aguarde um pouco.' }, { status: 429 });
  const { slug } = await params;
  const shop = await getPublicShop(slug);
  if (!shop || !shop.plan.active) return NextResponse.json({ slots: [] });
  const sp = req.nextUrl.searchParams;
  const date = sp.get('date') ?? '';
  const serviceIds = (sp.get('services') ?? '').split(',').filter(Boolean);
  const pro = sp.get('pro') ?? 'any';
  if (!isValidDate(date) || serviceIds.length === 0) return NextResponse.json({ slots: [] });
  const services = shop.services.filter((s) => serviceIds.includes(s.id));
  if (services.length !== new Set(serviceIds).size) return NextResponse.json({ slots: [] });
  const { durationMinutes } = sumServices(services);
  const able = shop.memberships.filter((m) => serviceIds.every((id) => m.services.some((s) => s.serviceId === id)));
  const targets = pro === 'any' ? able : able.filter((m) => m.id === pro);
  const all = new Set<number>();
  for (const t of targets) for (const s of await slotsFor(shop, t.id, date, durationMinutes)) all.add(s);
  return NextResponse.json(
    { slots: [...all].sort((a, b) => a - b).map(minuteToHHMM), durationMinutes },
    { headers: { 'cache-control': 'no-store' } },
  );
}
