import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { createSession } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const fail = NextResponse.redirect(`${env.appUrl}/entrar?aviso=google-erro`);
  const jar = await cookies();
  const raw = jar.get('fx_oauth')?.value;
  jar.delete('fx_oauth');
  const saved = raw ? (JSON.parse(raw) as { state: string; next: string; intent: string }) : null;
  const code = req.nextUrl.searchParams.get('code');
  if (!saved || !code || req.nextUrl.searchParams.get('state') !== saved.state) return fail;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId(),
      client_secret: env.googleClientSecret(),
      redirect_uri: `${env.appUrl}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) return fail;
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${access_token}` } });
  if (!infoRes.ok) return fail;
  const info = (await infoRes.json()) as { sub: string; email: string; email_verified: boolean; name?: string };
  if (!info.email || !info.email_verified) return fail;

  const email = info.email.toLowerCase();
  let user = await db.user.findFirst({ where: { OR: [{ googleId: info.sub }, { email }] } });
  if (user && !user.googleId) user = await db.user.update({ where: { id: user.id }, data: { googleId: info.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
  if (!user) user = await db.user.create({ data: { email, name: info.name || email.split('@')[0], googleId: info.sub, emailVerifiedAt: new Date() } });

  await createSession(user.id);
  const hasShop = await db.membership.findFirst({ where: { userId: user.id, active: true } });
  const dest = saved.next || (hasShop ? '/painel' : saved.intent === 'owner' ? '/painel/criar-loja' : '/meus-agendamentos');
  return NextResponse.redirect(`${env.appUrl}${dest}`);
}
