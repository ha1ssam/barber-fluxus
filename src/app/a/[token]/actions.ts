'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { clientCanCancel } from '@/lib/domain/appointment-status';
import { changeStatus } from '@/server/appointments';

export async function cancelByClientAction(token: string): Promise<{ ok: boolean; error?: string }> {
  const appt = await db.appointment.findUnique({ where: { publicToken: token } });
  if (!appt) return { ok: false, error: 'Agendamento não encontrado.' };
  if (!clientCanCancel(appt.status, appt.startsAt, new Date())) return { ok: false, error: 'Este agendamento não pode mais ser cancelado.' };
  const r = await changeStatus(appt.id, 'CANCELLED', { byClient: true });
  revalidatePath(`/a/${token}`);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

const reviewSchema = z.object({ token: z.string(), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() });

/** Só avalia quem teve atendimento concluído; uma avaliação por loja por cliente. */
export async function reviewAction(raw: z.input<typeof reviewSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Escolha de 1 a 5 estrelas.' };
  const { token, rating, comment } = parsed.data;
  const appt = await db.appointment.findUnique({ where: { publicToken: token }, include: { review: true } });
  if (!appt || appt.status !== 'COMPLETED') return { ok: false, error: 'Só dá para avaliar depois do atendimento concluído.' };
  if (appt.review) return { ok: false, error: 'Você já avaliou este atendimento.' };
  const already = await db.review.findFirst({ where: { shopId: appt.shopId, clientId: appt.clientId } });
  if (already) {
    await db.review.update({ where: { id: already.id }, data: { rating, comment: comment || null, createdAt: new Date() } });
  } else {
    await db.review.create({ data: { shopId: appt.shopId, appointmentId: appt.id, clientId: appt.clientId, rating, comment: comment || null } });
  }
  revalidatePath(`/a/${token}`);
  return { ok: true };
}
