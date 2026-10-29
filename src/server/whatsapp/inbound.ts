import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { handleBotMessage, HUMAN_HANDOFF_MINUTES, type BotState } from '@/lib/domain/bot';
import { normalizePhone } from '@/lib/domain/phone';
import { formatDateTimeBR } from '@/lib/domain/time';
import { changeStatus } from '../appointments';
import { sendNow, shopLink } from '../messages';

const MAX_INBOUND_PER_MINUTE = 10;

/** Mensagem recebida no WhatsApp da loja (do gateway de QR Code ou do webhook da Meta). */
export async function handleInbound(shopId: string, rawPhone: string, text: string, now = new Date()) {
  const phone = normalizePhone(rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`) ?? rawPhone.replace(/\D/g, '');
  const shop = await db.shop.findUnique({ where: { id: shopId } });
  if (!shop || !text.trim()) return;

  await db.messageLog.create({ data: { shopId, direction: 'IN', phone, body: text.slice(0, 4000) } });

  // Anti-spam: muitas mensagens no mesmo minuto não geram resposta.
  const recent = await db.messageLog.count({ where: { shopId, phone, direction: 'IN', createdAt: { gt: new Date(now.getTime() - 60_000) } } });
  if (recent > MAX_INBOUND_PER_MINUTE) return;

  const conversation = await db.botConversation.findUnique({ where: { shopId_phone: { shopId, phone } } });
  if (conversation?.humanUntil && conversation.humanUntil > now) return; // atendente humano respondendo

  const client = await db.client.findUnique({ where: { shopId_phone: { shopId, phone } } });
  const next = client
    ? await db.appointment.findFirst({
        where: { clientId: client.id, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gt: now } },
        orderBy: { startsAt: 'asc' },
      })
    : null;

  const result = handleBotMessage(text, (conversation?.state as BotState | undefined) ?? null, {
    shopName: shop.name,
    bookingLink: shopLink(shop.slug),
    nextAppointment: next ? { id: next.id, label: formatDateTimeBR(next.startsAt, shop.timezone), status: next.status as 'PENDING' | 'CONFIRMED' } : undefined,
  });

  const replies = [...result.replies];
  if (result.action?.type === 'confirm') {
    const r = await changeStatus(result.action.appointmentId, 'CONFIRMED', { byClient: true }, now);
    if (!r.ok) replies.splice(0, replies.length, r.error);
  } else if (result.action?.type === 'cancel') {
    const r = await changeStatus(result.action.appointmentId, 'CANCELLED', { byClient: true }, now);
    if (!r.ok) replies.splice(0, replies.length, r.error);
  }

  const humanUntil = result.action?.type === 'handoff' ? new Date(now.getTime() + HUMAN_HANDOFF_MINUTES * 60_000) : null;
  await db.botConversation.upsert({
    where: { shopId_phone: { shopId, phone } },
    update: { state: result.state as unknown as Prisma.InputJsonValue, humanUntil },
    create: { shopId, phone, state: result.state as unknown as Prisma.InputJsonValue, humanUntil },
  });

  for (const reply of replies) await sendNow(shopId, phone, reply);
}
