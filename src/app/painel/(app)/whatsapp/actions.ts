'use server';
import QRCode from 'qrcode';
import { z } from 'zod';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { hasFeature } from '@/lib/domain/plans';
import { DEFAULT_TEMPLATES } from '@/lib/domain/templates';
import { ActionError, memberForAction, runAction, type ActionResult } from '@/server/context';
import { gatewayRequest } from '@/server/whatsapp/provider';

export interface ConnectionView {
  status: string;
  phone: string | null;
  qrDataUrl: string | null;
}

async function syncFromGateway(shopId: string, body: { status?: string; qr?: string | null; phone?: string | null }): Promise<ConnectionView> {
  const status = (['DISCONNECTED', 'CONNECTING', 'QR', 'CONNECTED'].includes(body.status ?? '') ? body.status : 'DISCONNECTED') as 'QR';
  await db.whatsAppConnection.upsert({
    where: { shopId },
    update: { mode: 'QR', status, phone: body.phone ?? null, qr: body.qr ?? null },
    create: { shopId, mode: 'QR', status, phone: body.phone ?? null, qr: body.qr ?? null },
  });
  return { status, phone: body.phone ?? null, qrDataUrl: body.qr ? await QRCode.toDataURL(body.qr, { margin: 1, width: 280 }) : null };
}

export async function connectQrAction(): Promise<ActionResult<ConnectionView>> {
  return runAction(async () => {
    const ctx = await memberForAction('whatsapp', 'whatsapp_qr');
    const body = await gatewayRequest(`/sessions/${ctx.shop.id}/connect`, { method: 'POST' }).catch((e) => {
      throw new ActionError(`Não foi possível falar com o serviço de WhatsApp: ${(e as Error).message}`);
    });
    return { ok: true, data: await syncFromGateway(ctx.shop.id, body) };
  });
}

export async function qrStatusAction(): Promise<ActionResult<ConnectionView>> {
  return runAction(async () => {
    const ctx = await memberForAction('whatsapp');
    const body = await gatewayRequest(`/sessions/${ctx.shop.id}`).catch(() => ({ status: 'DISCONNECTED' }));
    return { ok: true, data: await syncFromGateway(ctx.shop.id, body) };
  });
}

export async function disconnectAction(): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('whatsapp');
    const conn = await db.whatsAppConnection.findUnique({ where: { shopId: ctx.shop.id } });
    if (conn?.mode === 'QR') await gatewayRequest(`/sessions/${ctx.shop.id}`, { method: 'DELETE' }).catch(() => undefined);
    await db.whatsAppConnection.update({ where: { shopId: ctx.shop.id }, data: { status: 'DISCONNECTED', qr: null, phone: null, cloudAccessTokenEnc: null } });
    return { ok: true, message: 'WhatsApp desconectado.' };
  });
}

const cloudSchema = z.object({ phoneNumberId: z.string().trim().regex(/^\d{6,20}$/, 'ID do número inválido.'), accessToken: z.string().trim().min(20, 'Token inválido.'), phone: z.string().trim().optional() });

export async function saveCloudAction(raw: z.input<typeof cloudSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('whatsapp', 'whatsapp_cloud');
    if (!hasFeature(ctx.plan, 'whatsapp_cloud')) throw new ActionError('A API oficial está no plano Equipe.');
    const parsed = cloudSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    const d = parsed.data;
    // Testa o token antes de salvar.
    const res = await fetch(`https://graph.facebook.com/v21.0/${d.phoneNumberId}?fields=display_phone_number`, { headers: { authorization: `Bearer ${d.accessToken}` } }).catch(() => null);
    if (!res?.ok) throw new ActionError('A Meta recusou o ID do número ou o token. Confira os dados no painel da Meta.');
    const info = (await res.json().catch(() => ({}))) as { display_phone_number?: string };
    const data = { mode: 'CLOUD_API' as const, status: 'CONNECTED' as const, cloudPhoneNumberId: d.phoneNumberId, cloudAccessTokenEnc: encrypt(d.accessToken), phone: info.display_phone_number ?? d.phone ?? null, qr: null };
    await db.whatsAppConnection.upsert({ where: { shopId: ctx.shop.id }, update: data, create: { shopId: ctx.shop.id, ...data } });
    return { ok: true, message: 'API oficial conectada.' };
  });
}

const reminderSchema = z.object({
  reminderHoursBefore: z.number().int().min(1, 'Entre 1 e 24 horas.').max(24, 'Entre 1 e 24 horas.'),
  reminderEveHour: z.number().int().min(8).max(22),
  winbackDays: z.number().int().min(15, 'Mínimo de 15 dias.').max(365),
});

export async function saveReminderConfigAction(raw: z.input<typeof reminderSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('whatsapp');
    const parsed = reminderSchema.safeParse(raw);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0].message);
    await db.shop.update({ where: { id: ctx.shop.id }, data: parsed.data });
    return { ok: true, message: 'Configuração salva.' };
  });
}

const kinds = Object.keys(DEFAULT_TEMPLATES) as (keyof typeof DEFAULT_TEMPLATES)[];

export async function saveTemplateAction(kind: string, enabled: boolean, body: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await memberForAction('whatsapp');
    if (!kinds.includes(kind as 'BOT') || kind === 'BOT') throw new ActionError('Mensagem inválida.');
    const text = body.trim();
    if (text.length < 5 || text.length > 1000) throw new ActionError('A mensagem precisa ter entre 5 e 1000 caracteres.');
    await db.messageTemplate.upsert({
      where: { shopId_kind: { shopId: ctx.shop.id, kind: kind as 'CONFIRMATION' } },
      update: { enabled, body: text },
      create: { shopId: ctx.shop.id, kind: kind as 'CONFIRMATION', enabled, body: text },
    });
    return { ok: true, message: 'Mensagem salva.' };
  });
}
