import 'server-only';
import type { MessageKind } from '@prisma/client';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { formatBRL } from '@/lib/domain/money';
import { hasFeature, planState } from '@/lib/domain/plans';
import { DEFAULT_TEMPLATES, renderTemplate, type TemplateVars } from '@/lib/domain/templates';
import { addDays, formatDateBR, formatDayMonth, minuteToHHMM, todayIn, utcToZoned, zonedToUtc } from '@/lib/domain/time';
import { senderFor, SendError } from './whatsapp/provider';

export async function getTemplate(shopId: string, kind: MessageKind) {
  const row = await db.messageTemplate.findUnique({ where: { shopId_kind: { shopId, kind } } });
  return { enabled: row?.enabled ?? true, body: row?.body || DEFAULT_TEMPLATES[kind].body };
}

export function shopLink(slug: string, query = '') {
  return `${env.appUrl}/${slug}${query}`;
}

async function appointmentVars(appointmentId: string): Promise<{ vars: TemplateVars; phone: string; shopId: string; clientId: string } | null> {
  const a = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { shop: true, client: true, services: true, professional: { include: { user: { select: { name: true } } } } },
  });
  if (!a) return null;
  const z = utcToZoned(a.startsAt, a.shop.timezone);
  return {
    shopId: a.shopId,
    clientId: a.clientId,
    phone: a.client.phone,
    vars: {
      nome: a.client.name.split(' ')[0],
      loja: a.shop.name,
      data: formatDayMonth(z.date),
      hora: minuteToHHMM(z.minute),
      servicos: a.services.map((s) => s.name).join(' + '),
      profissional: a.professional.displayName || a.professional.user.name,
      valor: formatBRL(a.totalPriceCents),
      link: `${env.appUrl}/a/${a.publicToken}`,
      endereco: [a.shop.addressLine, a.shop.neighborhood, a.shop.city].filter(Boolean).join(', '),
    },
  };
}

async function messagingAllowed(shopId: string) {
  const sub = await db.subscription.findUnique({ where: { shopId } });
  return hasFeature(planState(sub), 'auto_messages');
}

/** Coloca uma mensagem de agendamento na fila. Duplicatas (mesmo tipo e horário) são ignoradas. */
export async function enqueueAppointmentMessage(appointmentId: string, kind: MessageKind, sendAt: Date) {
  const info = await appointmentVars(appointmentId);
  if (!info) return;
  const tpl = await getTemplate(info.shopId, kind);
  if (!tpl.enabled || !(await messagingAllowed(info.shopId))) return;
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, select: { startsAt: true } });
  const dedupeKey = `${appointmentId}:${kind}:${appt?.startsAt.getTime()}`;
  await db.scheduledMessage.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      shopId: info.shopId,
      kind,
      toPhone: info.phone,
      body: renderTemplate(tpl.body, info.vars),
      sendAt,
      appointmentId,
      clientId: info.clientId,
      dedupeKey,
    },
  });
}

export async function cancelAppointmentMessages(appointmentId: string) {
  await db.scheduledMessage.updateMany({ where: { appointmentId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
}

/** Fila de espera ativa: quando um horário vaga, avisa quem está na fila daquele dia. */
export async function notifyWaitlist(shopId: string, freedAt: Date, professionalId: string, now = new Date()) {
  const shop = await db.shop.findUnique({ where: { id: shopId } });
  if (!shop || freedAt < now || !(await messagingAllowed(shopId))) return;
  const date = utcToZoned(freedAt, shop.timezone).date;
  const tpl = await getTemplate(shopId, 'WAITLIST');
  if (!tpl.enabled) return;
  const entries = await db.waitlistEntry.findMany({
    where: { shopId, date, status: 'WAITING', OR: [{ professionalId: null }, { professionalId }] },
    include: { client: true },
    orderBy: { createdAt: 'asc' },
    take: 3,
  });
  for (const e of entries) {
    const body = renderTemplate(tpl.body, {
      nome: e.client.name.split(' ')[0],
      loja: shop.name,
      data: formatDateBR(date),
      link: shopLink(shop.slug, `?data=${date}`),
    });
    await db.scheduledMessage.upsert({
      where: { dedupeKey: `waitlist:${e.id}:${freedAt.getTime()}` },
      update: {},
      create: { shopId, kind: 'WAITLIST', toPhone: e.client.phone, body, sendAt: now, clientId: e.clientId, dedupeKey: `waitlist:${e.id}:${freedAt.getTime()}` },
    });
    await db.waitlistEntry.update({ where: { id: e.id }, data: { status: 'NOTIFIED', notifiedAt: now } });
  }
}

const RELEVANT_STATUS: Partial<Record<MessageKind, string[]>> = {
  BOOKING_RECEIVED: ['PENDING'],
  CONFIRMATION: ['CONFIRMED'],
  REMINDER: ['PENDING', 'CONFIRMED'],
  REMINDER_EVE: ['PENDING', 'CONFIRMED'],
  REVIEW_REQUEST: ['COMPLETED'],
  CANCELLATION: ['CANCELLED'],
};

const MAX_ATTEMPTS = 5;

/** Envia as mensagens vencidas da fila. Chamado pelo worker ou por /api/cron/tick. */
export async function processDueMessages(now = new Date(), limit = 50) {
  const due = await db.scheduledMessage.findMany({
    where: { status: 'PENDING', sendAt: { lte: now } },
    orderBy: { sendAt: 'asc' },
    take: limit,
    include: { appointment: { select: { status: true } } },
  });
  let sent = 0;
  for (const msg of due) {
    // "Aluga" a mensagem por 5 minutos para dois workers não mandarem a mesma.
    const claim = await db.scheduledMessage.updateMany({
      where: { id: msg.id, status: 'PENDING', sendAt: msg.sendAt },
      data: { sendAt: new Date(now.getTime() + 5 * 60_000), attempts: { increment: 1 } },
    });
    if (claim.count === 0) continue;
    const relevant = RELEVANT_STATUS[msg.kind];
    if (relevant && msg.appointment && !relevant.includes(msg.appointment.status)) {
      await db.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'SKIPPED', lastError: 'Agendamento mudou de status.' } });
      continue;
    }
    try {
      const sender = await senderFor(msg.shopId);
      if (!sender) {
        await db.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'SKIPPED', lastError: 'WhatsApp não conectado.' } });
        continue;
      }
      await sender.send(msg.toPhone, msg.body);
      await db.$transaction([
        db.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'SENT', sentAt: new Date(), lastError: null } }),
        db.messageLog.create({ data: { shopId: msg.shopId, direction: 'OUT', phone: msg.toPhone, body: msg.body, kind: msg.kind } }),
      ]);
      sent++;
    } catch (e) {
      const retryable = !(e instanceof SendError) || e.retryable;
      const attempts = msg.attempts + 1;
      const failed = !retryable || attempts >= MAX_ATTEMPTS;
      await db.scheduledMessage.update({
        where: { id: msg.id },
        data: {
          status: failed ? 'FAILED' : 'PENDING',
          lastError: String((e as Error).message).slice(0, 500),
          sendAt: new Date(now.getTime() + 2 ** attempts * 60_000),
        },
      });
    }
  }
  return { processed: due.length, sent };
}

/** Aniversariantes e clientes sumidos. Roda a cada tick; a chave de duplicidade garante um envio por ocasião. */
export async function scheduleDailyCampaigns(now = new Date()) {
  const shops = await db.shop.findMany({ include: { subscription: true } });
  let created = 0;
  for (const shop of shops) {
    if (!hasFeature(planState(shop.subscription, now), 'auto_messages')) continue;
    const today = todayIn(shop.timezone, now);
    const [birthdayTpl, winbackTpl] = await Promise.all([getTemplate(shop.id, 'BIRTHDAY'), getTemplate(shop.id, 'WINBACK')]);
    const link = shopLink(shop.slug);

    if (birthdayTpl.enabled) {
      const mmdd = today.slice(5);
      const clients = await db.$queryRaw<{ id: string; name: string; phone: string }[]>`
        SELECT id, name, phone FROM "Client" WHERE "shopId" = ${shop.id} AND to_char("birthDate", 'MM-DD') = ${mmdd}`;
      const sendAt = zonedToUtc(today, 10 * 60, shop.timezone);
      for (const c of clients) {
        const dedupeKey = `${c.id}:BIRTHDAY:${today.slice(0, 4)}`;
        const r = await db.scheduledMessage.createMany({
          data: [{ shopId: shop.id, kind: 'BIRTHDAY', toPhone: c.phone, clientId: c.id, sendAt: sendAt < now ? now : sendAt, dedupeKey, body: renderTemplate(birthdayTpl.body, { nome: c.name.split(' ')[0], loja: shop.name, link }) }],
          skipDuplicates: true,
        });
        created += r.count;
      }
    }

    if (winbackTpl.enabled && shop.winbackDays > 0) {
      const cutoff = zonedToUtc(addDays(today, -shop.winbackDays), 0, shop.timezone);
      // Última visita concluída antes do corte e nenhum horário futuro marcado.
      const clients = await db.$queryRaw<{ id: string; name: string; phone: string; last: Date }[]>`
        SELECT c.id, c.name, c.phone, MAX(a."startsAt") AS last
        FROM "Client" c JOIN "Appointment" a ON a."clientId" = c.id AND a.status = 'COMPLETED'
        WHERE c."shopId" = ${shop.id}
          AND NOT EXISTS (SELECT 1 FROM "Appointment" f WHERE f."clientId" = c.id AND f.status IN ('PENDING','CONFIRMED') AND f."startsAt" > ${now})
        GROUP BY c.id HAVING MAX(a."startsAt") < ${cutoff}`;
      for (const c of clients) {
        const dedupeKey = `${c.id}:WINBACK:${c.last.toISOString().slice(0, 10)}`;
        const r = await db.scheduledMessage.createMany({
          data: [{ shopId: shop.id, kind: 'WINBACK', toPhone: c.phone, clientId: c.id, sendAt: zonedToUtc(today, 11 * 60, shop.timezone) < now ? now : zonedToUtc(today, 11 * 60, shop.timezone), dedupeKey, body: renderTemplate(winbackTpl.body, { nome: c.name.split(' ')[0], loja: shop.name, link }) }],
          skipDuplicates: true,
        });
        created += r.count;
      }
    }
  }
  return { created };
}

/** Envio direto (respostas do robô). Registra no histórico. */
export async function sendNow(shopId: string, phone: string, body: string, kind: MessageKind = 'BOT') {
  const sender = await senderFor(shopId);
  if (!sender) return false;
  await sender.send(phone, body);
  await db.messageLog.create({ data: { shopId, direction: 'OUT', phone, body, kind } });
  return true;
}
