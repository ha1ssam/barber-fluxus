import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { consumeToken } from '@/lib/auth/tokens';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const userId = await consumeToken(token, 'VERIFY_EMAIL');
  if (userId) await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return NextResponse.redirect(`${env.appUrl}/entrar?aviso=${userId ? 'email-verificado' : 'google-erro'}`);
}
