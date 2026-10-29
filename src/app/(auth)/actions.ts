'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, MIN_PASSWORD, verifyPassword } from '@/lib/auth/password';
import { clientIp, createSession, destroySession } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/redirect';
import { consumeToken, sendResetEmail, sendVerificationEmail } from '@/lib/auth/tokens';
import { isValidCpf, normalizeCpf } from '@/lib/domain/cpf';
import { normalizePhone } from '@/lib/domain/phone';
import { rateLimit } from '@/lib/rate-limit';
import { createShopForOwner } from '@/server/shops';

export type FormState = { error?: string; ok?: string } | undefined;

async function landingFor(userId: string) {
  const m = await db.membership.findFirst({ where: { userId, active: true } });
  return m ? '/painel' : '/meus-agendamentos';
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!rateLimit(`login:${await clientIp()}`, 10, 10 * 60_000)) return { error: 'Muitas tentativas. Aguarde alguns minutos.' };
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return { error: 'Email ou senha incorretos.' };
  await createSession(user.id);
  redirect(safeNext(form.get('next'), await landingFor(user.id)));
}

const signupSchema = z.object({
  kind: z.enum(['owner', 'client']),
  name: z.string().trim().min(2, 'Informe seu nome.').max(80),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  phone: z.string().trim().min(8, 'Informe seu telefone.'),
  password: z.string().min(MIN_PASSWORD, `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`),
  shopName: z.string().trim().optional(),
  businessType: z.enum(['BARBERSHOP', 'SALON', 'AESTHETICS', 'NAILS', 'OTHER']).optional(),
  cpf: z.string().optional(),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const ip = await clientIp();
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60_000)) return { error: 'Muitos cadastros deste endereço. Tente mais tarde.' };
  const phone = normalizePhone(d.phone);
  if (!phone) return { error: 'Telefone inválido. Use DDD + número.' };
  if (d.kind === 'owner') {
    if (!d.shopName || d.shopName.length < 2) return { error: 'Informe o nome do seu negócio.' };
    if (!d.cpf || !isValidCpf(d.cpf)) return { error: 'CPF inválido.' };
  }
  if (await db.user.findUnique({ where: { email: d.email } })) return { error: 'Já existe uma conta com este e-mail. Entre ou recupere a senha.' };

  const user = await db.user.create({
    data: { name: d.name, email: d.email, phone, passwordHash: await hashPassword(d.password), cpf: d.kind === 'owner' && d.cpf ? normalizeCpf(d.cpf) : null },
  });
  let shopId: string | null = null;
  if (d.kind === 'owner') {
    const { shop } = await createShopForOwner({ userId: user.id, name: d.shopName!, businessType: d.businessType ?? 'BARBERSHOP', cpf: d.cpf, ip });
    shopId = shop.id;
  }
  await sendVerificationEmail(user);
  await createSession(user.id, shopId);
  redirect(safeNext(form.get('next'), d.kind === 'owner' ? '/painel?bem-vindo=1' : '/meus-agendamentos'));
}

export async function requestResetAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!rateLimit(`reset:${await clientIp()}`, 5, 60 * 60_000)) return { error: 'Muitas tentativas. Tente mais tarde.' };
  const user = await db.user.findUnique({ where: { email } });
  if (user) await sendResetEmail(user);
  return { ok: 'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.' };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');
  if (password.length < MIN_PASSWORD) return { error: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` };
  if (password !== String(form.get('confirm') ?? '')) return { error: 'As senhas não conferem.' };
  const userId = await consumeToken(token, 'RESET_PASSWORD');
  if (!userId) return { error: 'Link inválido ou vencido. Peça outro.' };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await db.session.deleteMany({ where: { userId } });
  await createSession(userId);
  redirect(await landingFor(userId));
}

export async function logoutAction() {
  await destroySession();
  redirect('/entrar');
}
