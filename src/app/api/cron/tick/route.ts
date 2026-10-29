import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { tick } from '@/server/jobs';

/** Chamado pelo worker (scripts/worker.ts) ou por um cron externo a cada minuto. */
async function handle(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  if (!safeEqual(auth, `Bearer ${env.cronSecret}`)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  return NextResponse.json(await tick());
}

export const GET = handle;
export const POST = handle;
