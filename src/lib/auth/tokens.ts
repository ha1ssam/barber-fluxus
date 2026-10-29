import 'server-only';
import type { AuthTokenKind } from '@prisma/client';
import { db } from '../db';
import { env } from '../env';
import { randomToken, sha256 } from '../crypto';
import { emailLayout, sendEmail } from '../email';

const TTL: Record<AuthTokenKind, number> = { VERIFY_EMAIL: 48 * 3_600_000, RESET_PASSWORD: 3_600_000 };

export async function issueToken(userId: string, kind: AuthTokenKind) {
  const token = randomToken();
  await db.authToken.create({ data: { userId, kind, tokenHash: sha256(token), expiresAt: new Date(Date.now() + TTL[kind]) } });
  return token;
}

export async function consumeToken(token: string, kind: AuthTokenKind) {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) return null;
  await db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}

export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, 'VERIFY_EMAIL');
  await sendEmail(
    user.email,
    'Confirme seu e-mail',
    emailLayout(`Olá, ${user.name.split(' ')[0]}!`, 'Confirme seu e-mail para proteger sua conta.', { label: 'Confirmar e-mail', url: `${env.appUrl}/verificar-email?token=${token}` }),
  );
}

export async function sendResetEmail(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, 'RESET_PASSWORD');
  await sendEmail(
    user.email,
    'Redefinir sua senha',
    emailLayout('Redefinir senha', 'Recebemos um pedido para trocar sua senha. O link vale por 1 hora.', { label: 'Criar nova senha', url: `${env.appUrl}/redefinir-senha?token=${token}` }),
  );
}
