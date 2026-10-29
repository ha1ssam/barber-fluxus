import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';

const schema = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Entre de novo.' }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Inscrição inválida.' }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  await db.pushSubscription.upsert({ where: { endpoint }, update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth }, create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth } });
  return NextResponse.json({ ok: true });
}
