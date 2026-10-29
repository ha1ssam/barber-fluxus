'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, MIN_PASSWORD, verifyPassword } from '@/lib/auth/password';
import { destroySession } from '@/lib/auth/session';
import { ALLOWED_SLOT_INTERVALS } from '@/lib/domain/availability';
import { AMENITY_OPTIONS, PAYMENT_OPTIONS, UFS } from '@/lib/domain/labels';
import { normalizePhone } from '@/lib/domain/phone';
import { isValidSlug } from '@/lib/domain/slug';
import { ActionError, canMember, memberForAction, runAction, type ActionResult } from '@/server/context';

const optional = z.string().trim().max(200).optional().transform((v) => v || null);
const imageUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null)
  .refine((v) => !v || v.startsWith('/api/files/') || /^https:\/\//.test(v), 'Imagem inválida.');

const shopSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome.').max(60),
  slug: z.string().trim().toLowerCase(),
  businessType: z.enum(['BARBERSHOP', 'SALON', 'AESTHETICS', 'NAILS', 'OTHER']),
  description: z.string().trim().max(500).optional().transform((v) => v || null),
  phone: z.string().optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').or(z.literal('')).optional().transform((v) => v || null),
  addressLine: optional,
  neighborhood: optional,
  city: optional,
  state: z.string().optional().transform((v) => (v && UFS.includes(v) ? v : null)),
  zipCode: optional,
  instagram: z.string().trim().max(60).optional().transform((v) => v?.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') || null),
  facebook: optional,
  tiktok: z.string().trim().max(60).optional().transform((v) => v?.replace(/^@/, '') || null),
  logoUrl: imageUrl,
  coverUrl: imageUrl,
  paymentMethods: z.array(z.string()).transform((xs) => xs.filter((x) => x in PAYMENT_OPTIONS)),
  amenities: z.array(z.string()).transform((xs) => xs.filter((x) => x in AMENITY_OPTIONS)),
});

export async function saveShopAction(raw: z.input<typeof shopSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('settings');
    const parsed = shopSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const d = parsed.data;
    if (!isValidSlug(d.slug)) throw new ActionError('Endereço inválido. Use letras minúsculas, números e hífen (3 a 48 caracteres).');
    if (d.slug !== ctx.shop.slug && (await db.shop.findUnique({ where: { slug: d.slug } }))) throw new ActionError('Este endereço já está em uso.');
    const phone = d.phone ? normalizePhone(d.phone) : null;
    if (d.phone && !phone) throw new ActionError('Telefone inválido.');
    await db.shop.update({ where: { id: ctx.shop.id }, data: { ...d, phone } });
    return { ok: true, message: 'Dados da loja salvos.' };
  });
}

const agendaSchema = z.object({
  slotInterval: z.number().refine((v) => (ALLOWED_SLOT_INTERVALS as readonly number[]).includes(v), 'Grade inválida.'),
  bufferMinutes: z.number().int().min(0).max(60),
  minAdvanceMinutes: z.number().int().min(0).max(7 * 24 * 60),
  maxAdvanceDays: z.number().int().min(1).max(365),
  autoConfirm: z.boolean(),
  listedInExplore: z.boolean(),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Fuso inválido.'),
});

export async function saveAgendaAction(raw: z.input<typeof agendaSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('settings');
    const parsed = agendaSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    await db.shop.update({ where: { id: ctx.shop.id }, data: parsed.data });
    return { ok: true, message: 'Regras da agenda salvas.' };
  });
}

const hoursSchema = z.object({
  membershipId: z.string(),
  days: z.array(z.object({ weekday: z.number().int().min(0).max(6), shifts: z.array(z.object({ start: z.number().int().min(0).max(1440), end: z.number().int().min(0).max(1440) })).max(3) })),
});

export async function saveHoursAction(raw: z.input<typeof hoursSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('agenda.own');
    const parsed = hoursSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError('Horários inválidos.');
    const { membershipId, days } = parsed.data;
    const target = await db.membership.findFirst({ where: { id: membershipId, shopId: ctx.shop.id } });
    if (!target) throw new ActionError('Profissional não encontrado.');
    const own = target.id === ctx.membership.id && ctx.membership.canManageOwnSchedule;
    if (!canMember(ctx, 'settings') && !own) throw new ActionError('Você não pode alterar esses horários.');
    const rows: { membershipId: string; weekday: number; startMinute: number; endMinute: number }[] = [];
    for (const d of days) {
      const sorted = [...d.shifts].sort((a, b) => a.start - b.start);
      for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        if (s.end <= s.start) throw new ActionError('Em cada turno, o fim precisa ser depois do início.');
        if (i > 0 && s.start < sorted[i - 1].end) throw new ActionError('Os turnos de um mesmo dia não podem se sobrepor.');
        rows.push({ membershipId, weekday: d.weekday, startMinute: s.start, endMinute: s.end });
      }
    }
    await db.$transaction([db.workingHours.deleteMany({ where: { membershipId } }), db.workingHours.createMany({ data: rows })]);
    return { ok: true, message: 'Horários salvos.' };
  });
}

const profileSchema = z.object({ name: z.string().trim().min(2).max(80), phone: z.string() });

export async function saveProfileAction(raw: z.input<typeof profileSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction();
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError('Confira seu nome.');
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) throw new ActionError('Telefone inválido.');
    await db.user.update({ where: { id: ctx.user.id }, data: { name: parsed.data.name, phone } });
    return { ok: true, message: 'Perfil salvo.' };
  });
}

export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction();
    if (next.length < MIN_PASSWORD) throw new ActionError(`A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    if (ctx.user.passwordHash && !(await verifyPassword(current, ctx.user.passwordHash))) throw new ActionError('Senha atual incorreta.');
    await db.user.update({ where: { id: ctx.user.id }, data: { passwordHash: await hashPassword(next) } });
    return { ok: true, message: 'Senha alterada.' };
  });
}

/** Exclui a conta (com senha). O dono leva a loja junto. Se houver histórico em outra loja, a conta é anonimizada. */
export async function deleteAccountAction(password: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction();
    if (!ctx.user.passwordHash || !(await verifyPassword(password, ctx.user.passwordHash))) throw new ActionError('Senha incorreta.');
    const owned = await db.membership.findMany({ where: { userId: ctx.user.id, role: 'OWNER' }, select: { shopId: true } });
    await db.shop.deleteMany({ where: { id: { in: owned.map((o) => o.shopId) } } });
    try {
      await db.user.delete({ where: { id: ctx.user.id } });
    } catch {
      await db.$transaction([
        db.session.deleteMany({ where: { userId: ctx.user.id } }),
        db.membership.updateMany({ where: { userId: ctx.user.id }, data: { active: false } }),
        db.user.update({ where: { id: ctx.user.id }, data: { email: `excluido-${ctx.user.id}@fluxus.invalid`, name: 'Conta excluída', phone: null, cpf: null, passwordHash: null, googleId: null } }),
      ]);
    }
    await destroySession();
    redirect('/');
  });
}
