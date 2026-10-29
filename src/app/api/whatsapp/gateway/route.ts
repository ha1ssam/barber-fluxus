import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { handleInbound } from '@/server/whatsapp/inbound';

/**
 * Eventos do gateway de QR Code (services/whatsapp-gateway):
 * { type: 'message', shopId, from, text } ou { type: 'status', shopId, status, phone?, qr? }
 */
export async function POST(req: NextRequest) {
  const secret = env.gatewaySecret();
  if (!secret || !safeEqual(req.headers.get('x-gateway-secret') ?? '', secret)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { type?: string; shopId?: string; from?: string; text?: string; status?: string; phone?: string; qr?: string } | null;
  if (!body?.shopId || !(await db.shop.findUnique({ where: { id: body.shopId }, select: { id: true } }))) return NextResponse.json({ error: 'loja inválida' }, { status: 400 });
  if (body.type === 'message' && body.from && body.text) {
    await handleInbound(body.shopId, body.from, body.text);
  } else if (body.type === 'status' && body.status && ['DISCONNECTED', 'CONNECTING', 'QR', 'CONNECTED'].includes(body.status)) {
    await db.whatsAppConnection.upsert({
      where: { shopId: body.shopId },
      update: { status: body.status as 'QR', phone: body.phone ?? undefined, qr: body.qr ?? null },
      create: { shopId: body.shopId, mode: 'QR', status: body.status as 'QR', phone: body.phone ?? null, qr: body.qr ?? null },
    });
  }
  return NextResponse.json({ ok: true });
}
