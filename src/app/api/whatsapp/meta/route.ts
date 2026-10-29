import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { hmacSha256Hex, safeEqual } from '@/lib/crypto';
import { handleInbound } from '@/server/whatsapp/inbound';

/** Verificação do webhook da API oficial (Meta). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get('hub.mode') === 'subscribe' && env.metaVerifyToken() && sp.get('hub.verify_token') === env.metaVerifyToken()) {
    return new NextResponse(sp.get('hub.challenge') ?? '', { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

interface MetaPayload {
  entry?: { changes?: { value?: { metadata?: { phone_number_id?: string }; messages?: { from: string; type: string; text?: { body: string }; button?: { text: string } }[] } }[] }[];
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-hub-signature-256') ?? '';
  if (!env.metaAppSecret() || !safeEqual(sig, `sha256=${hmacSha256Hex(env.metaAppSecret(), raw)}`)) return new NextResponse('assinatura inválida', { status: 401 });
  const payload = JSON.parse(raw) as MetaPayload;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const conn = await db.whatsAppConnection.findFirst({ where: { cloudPhoneNumberId: phoneNumberId, mode: 'CLOUD_API' } });
      if (!conn) continue;
      for (const m of change.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text;
        if (text) await handleInbound(conn.shopId, m.from, text);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
