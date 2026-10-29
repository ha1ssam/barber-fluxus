import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { randomToken } from '@/lib/crypto';
import { safeNext } from '@/lib/auth/redirect';

export async function GET(req: NextRequest) {
  if (!env.googleClientId()) return NextResponse.redirect(`${env.appUrl}/entrar`);
  const state = randomToken(16);
  const next = safeNext(req.nextUrl.searchParams.get('next'), '');
  const intent = req.nextUrl.searchParams.get('intent') === 'owner' ? 'owner' : 'client';
  (await cookies()).set('fx_oauth', JSON.stringify({ state, next, intent }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 });
  const params = new URLSearchParams({
    client_id: env.googleClientId(),
    redirect_uri: `${env.appUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
