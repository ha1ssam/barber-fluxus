import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createAppointment } from '@/server/booking';
import { changeStatus, reschedule } from '@/server/appointments';
import { checkout } from '@/server/finance';
import { processDueMessages } from '@/server/messages';
import { handleInbound } from '@/server/whatsapp/inbound';
import { makeShop, MONDAY, NOW } from './helpers';

const client = (i = 0) => ({ name: `Cliente ${i}`, phone: `551199999${String(1000 + i)}` });
const AFTER = new Date('2030-03-04T14:00:00Z'); // segunda, 11h em SP

describe('reserva', () => {
  it('reservas simultâneas no mesmo horário: só uma passa', async () => {
    const { shop, barberM, corte } = await makeShop();
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 10 * 60, client: client(i), source: 'ONLINE', now: NOW }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error === 'Este horário já está ocupado.')).toBe(true);
  });

  it('"sem preferência" usa o próximo profissional livre', async () => {
    const { shop, ownerM, barberM, corte } = await makeShop();
    const book = (i: number) => createAppointment({ shopId: shop.id, professionalId: 'any', serviceIds: [corte.id], date: MONDAY, startMinute: 9 * 60, client: client(i), source: 'ONLINE', now: NOW });
    const a = await book(1);
    const b = await book(2);
    const c = await book(3);
    expect(a.ok && b.ok).toBe(true);
    expect(c.ok).toBe(false);
    const pros = await db.appointment.findMany({ where: { shopId: shop.id }, select: { professionalId: true } });
    expect(new Set(pros.map((p) => p.professionalId))).toEqual(new Set([ownerM.id, barberM.id]));
  });

  it('valida no servidor: fora do expediente, almoço, data passada e serviço que o profissional não faz', async () => {
    const { shop, barberM, corte, barba } = await makeShop();
    const base = { shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, client: client(), source: 'ONLINE' as const, now: NOW };
    expect(await createAppointment({ ...base, startMinute: 8 * 60 })).toMatchObject({ ok: false, error: 'Este horário está fora do expediente.' });
    expect(await createAppointment({ ...base, startMinute: 12 * 60 })).toMatchObject({ ok: false });
    expect(await createAppointment({ ...base, date: '2030-03-01', startMinute: 10 * 60 })).toMatchObject({ ok: false });
    expect(await createAppointment({ ...base, serviceIds: [barba.id], startMinute: 10 * 60 })).toMatchObject({
      ok: false,
      error: 'Este profissional não faz todos os serviços escolhidos.',
    });
  });

  it('encaixe manual pode sair da grade, mas nunca sobrepor', async () => {
    const { shop, barberM, corte } = await makeShop();
    const manual = { shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, client: client(), source: 'MANUAL' as const, allowOutsideHours: true, now: NOW };
    expect((await createAppointment({ ...manual, startMinute: 12 * 60 + 10 })).ok).toBe(true);
    expect((await createAppointment({ ...manual, client: client(2), startMinute: 12 * 60 + 20 })).ok).toBe(false);
  });

  it('assinatura vencida bloqueia novas reservas', async () => {
    const { shop, barberM, corte } = await makeShop();
    await db.subscription.update({ where: { shopId: shop.id }, data: { trialEndsAt: new Date('2030-03-01T00:00:00Z') } });
    const r = await createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 10 * 60, client: client(), source: 'ONLINE', now: NOW });
    expect(r).toEqual({ ok: false, error: 'Esta loja não está aceitando reservas no momento.' });
  });

  it('cliente é um cadastro só, identificado pelo telefone', async () => {
    const { shop, barberM, corte } = await makeShop();
    const phone = '5511988887777';
    await createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 9 * 60, client: { name: 'João', phone }, source: 'ONLINE', now: NOW });
    await createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 10 * 60, client: { name: 'João Silva', phone }, source: 'ONLINE', now: NOW });
    expect(await db.client.count({ where: { shopId: shop.id } })).toBe(1);
  });
});

describe('ciclo de vida e mensagens', () => {
  it('pendente gera aviso e lembretes; confirmar gera confirmação; cancelar avisa a fila', async () => {
    const { shop, barberM, corte } = await makeShop();
    const r = await createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 10 * 60, client: client(), source: 'ONLINE', now: NOW });
    if (!r.ok) throw new Error(r.error);
    const kinds = async () => (await db.scheduledMessage.findMany({ where: { appointmentId: r.appointmentId }, orderBy: { sendAt: 'asc' } })).map((m) => `${m.kind}:${m.status}`);
    expect(await kinds()).toEqual(['BOOKING_RECEIVED:PENDING', 'REMINDER_EVE:PENDING', 'REMINDER:PENDING']);

    expect(await changeStatus(r.appointmentId, 'CONFIRMED', {}, NOW)).toEqual({ ok: true });
    expect(await kinds()).toContain('CONFIRMATION:PENDING');

    const waiting = await db.client.create({ data: { shopId: shop.id, name: 'Na fila', phone: '5511977776666', referralCode: `W${Date.now()}`.slice(0, 12) } });
    await db.waitlistEntry.create({ data: { shopId: shop.id, clientId: waiting.id, date: MONDAY } });
    expect(await changeStatus(r.appointmentId, 'CANCELLED', {}, NOW)).toEqual({ ok: true });
    expect(await kinds()).toContain('CANCELLATION:PENDING');
    expect((await kinds()).filter((k) => k.startsWith('REMINDER')).every((k) => k.endsWith('CANCELLED'))).toBe(true);
    expect(await db.scheduledMessage.count({ where: { shopId: shop.id, kind: 'WAITLIST' } })).toBe(1);
    expect((await db.waitlistEntry.findFirstOrThrow({ where: { clientId: waiting.id } })).status).toBe('NOTIFIED');
  });

  it('a fila de saída envia o que venceu', async () => {
    const { shop, barberM, corte } = await makeShop({ autoConfirm: true });
    const r = await createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 10 * 60, client: client(), source: 'ONLINE', now: NOW });
    if (!r.ok) throw new Error(r.error);
    await processDueMessages(NOW);
    const conf = await db.scheduledMessage.findFirstOrThrow({ where: { appointmentId: r.appointmentId, kind: 'CONFIRMATION' } });
    expect(conf.status).toBe('SENT');
    expect(conf.body).toContain('confirmado');
    expect(await db.messageLog.count({ where: { shopId: shop.id, direction: 'OUT' } })).toBe(1);
  });

  it('lembrete de agendamento cancelado não sai', async () => {
    const { shop, barberM, corte } = await makeShop({ autoConfirm: true });
    const r = await createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 10 * 60, client: client(), source: 'ONLINE', now: NOW });
    if (!r.ok) throw new Error(r.error);
    await db.appointment.update({ where: { id: r.appointmentId }, data: { status: 'CANCELLED' } }); // mudou por fora
    await processDueMessages(new Date('2030-03-04T12:00:00Z'));
    const reminder = await db.scheduledMessage.findFirstOrThrow({ where: { appointmentId: r.appointmentId, kind: 'REMINDER' } });
    expect(reminder.status).toBe('SKIPPED');
  });

  it('remarcar valida o novo horário e refaz os lembretes', async () => {
    const { shop, barberM, corte } = await makeShop();
    const a = await createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 9 * 60, client: client(1), source: 'ONLINE', now: NOW });
    const b = await createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 10 * 60, client: client(2), source: 'ONLINE', now: NOW });
    if (!a.ok || !b.ok) throw new Error('setup');
    expect(await reschedule(a.appointmentId, { date: MONDAY, startMinute: 10 * 60 }, NOW)).toEqual({ ok: false, error: 'Este horário já está ocupado.' });
    expect(await reschedule(a.appointmentId, { date: MONDAY, startMinute: 14 * 60 }, NOW)).toEqual({ ok: true });
    const pending = await db.scheduledMessage.findMany({ where: { appointmentId: a.appointmentId, status: 'PENDING', kind: 'REMINDER' } });
    expect(pending).toHaveLength(1);
    expect(pending[0].sendAt.toISOString()).toBe('2030-03-04T14:00:00.000Z'); // 14h SP menos 3h = 11h SP
  });

  it('robô: cliente responde SIM e o horário é confirmado', async () => {
    const { shop, barberM, corte } = await makeShop();
    const r = await createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 10 * 60, client: client(5), source: 'ONLINE', now: NOW });
    if (!r.ok) throw new Error(r.error);
    await handleInbound(shop.id, client(5).phone, 'Sim', NOW);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: r.appointmentId } })).status).toBe('CONFIRMED');
    expect(await db.messageLog.count({ where: { shopId: shop.id, direction: 'IN' } })).toBe(1);
    expect(await db.botConversation.count({ where: { shopId: shop.id } })).toBe(1);
  });
});

describe('caixa e fidelidade', () => {
  it('concluir só depois do término; venda soma selo, cupom e bônus de indicação', async () => {
    const { shop, owner, barberM, corte } = await makeShop();
    const referrer = await db.client.create({ data: { shopId: shop.id, name: 'Quem indicou', phone: '5511966665555', referralCode: `R${Date.now()}`.slice(0, 10) } });
    const r = await createAppointment({
      shopId: shop.id,
      professionalId: barberM.id,
      serviceIds: [corte.id],
      date: MONDAY,
      startMinute: 10 * 60,
      client: { ...client(7), referralCode: referrer.referralCode },
      source: 'ONLINE',
      now: NOW,
    });
    if (!r.ok) throw new Error(r.error);
    await db.coupon.create({ data: { shopId: shop.id, code: 'DEZ', type: 'PERCENT', value: 1000 } });
    const product = await db.product.create({ data: { shopId: shop.id, name: 'Pomada', priceCents: 4000 } });

    const early = await checkout({ shopId: shop.id, userId: owner.id, appointmentId: r.appointmentId, products: [], paymentMethod: 'PIX', now: NOW });
    expect(early).toEqual({ ok: false, error: 'O agendamento só pode ser concluído após o horário de término.' });

    const done = await checkout({
      shopId: shop.id,
      userId: owner.id,
      appointmentId: r.appointmentId,
      products: [{ productId: product.id, quantity: 1 }],
      paymentMethod: 'PIX',
      couponCode: 'dez',
      now: AFTER,
    });
    expect(done).toMatchObject({ ok: true, totalCents: 8100 }); // (50 + 40) - 10%
    const appt = await db.appointment.findUniqueOrThrow({ where: { id: r.appointmentId }, include: { client: true } });
    expect(appt.status).toBe('COMPLETED');
    expect(appt.client.stamps).toBe(1);
    expect((await db.client.findUniqueOrThrow({ where: { id: referrer.id } })).stamps).toBe(1);
    expect((await db.coupon.findFirstOrThrow({ where: { shopId: shop.id } })).uses).toBe(1);
    expect(await db.scheduledMessage.count({ where: { appointmentId: r.appointmentId, kind: 'REVIEW_REQUEST' } })).toBe(1);

    const again = await checkout({ shopId: shop.id, userId: owner.id, appointmentId: r.appointmentId, products: [], paymentMethod: 'PIX', now: AFTER });
    expect(again.ok).toBe(false);
  });

  it('prêmio de fidelidade desconta o serviço e gasta os selos', async () => {
    const { shop, owner, barberM, corte } = await makeShop();
    const r = await createAppointment({ shopId: shop.id, professionalId: barberM.id, serviceIds: [corte.id], date: MONDAY, startMinute: 10 * 60, client: client(8), source: 'ONLINE', now: NOW });
    if (!r.ok) throw new Error(r.error);
    const appt = await db.appointment.findUniqueOrThrow({ where: { id: r.appointmentId } });
    await db.client.update({ where: { id: appt.clientId }, data: { stamps: 10 } });
    const done = await checkout({ shopId: shop.id, userId: owner.id, appointmentId: r.appointmentId, products: [], paymentMethod: 'CASH', redeemReward: true, now: AFTER });
    expect(done).toMatchObject({ ok: true, totalCents: 0 });
    expect((await db.client.findUniqueOrThrow({ where: { id: appt.clientId } })).stamps).toBe(1); // 10 - 10 + 1 da visita
  });
});
