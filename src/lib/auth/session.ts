import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { db } from '../db';
import { randomToken, sha256 } from '../crypto';

// Sessão em banco + cookie HttpOnly. O cookie guarda só um token aleatório; o banco guarda o hash.
export const SESSION_COOKIE = 'fx_session';
const SESSION_DAYS = 30;

export async function createSession(userId: string, shopId?: string | null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { tokenHash: sha256(token), userId, shopId: shopId ?? null, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export const getSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
});

export async function getCurrentUser() {
  return (await getSession())?.user ?? null;
}

export async function setActiveShop(shopId: string) {
  const session = await getSession();
  if (session) await db.session.update({ where: { id: session.id }, data: { shopId } });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || '0.0.0.0').trim();
}
