import { describe, expect, it } from 'vitest';
import { canTransition, clientCanCancel } from '@/lib/domain/appointment-status';
import { canAddProfessional, hasFeature, planState } from '@/lib/domain/plans';
import { can } from '@/lib/domain/permissions';
import { computeCommission } from '@/lib/domain/commission';
import { couponDiscount, couponProblem, hasReward, stampsToReward } from '@/lib/domain/loyalty';
import { formatBRL, parseBRL } from '@/lib/domain/money';
import { formatPhone, normalizePhone } from '@/lib/domain/phone';
import { isValidCpf } from '@/lib/domain/cpf';
import { isValidSlug, slugify } from '@/lib/domain/slug';
import { renderTemplate } from '@/lib/domain/templates';
import { planReminders } from '@/lib/domain/reminders';

const now = new Date('2026-03-15T15:00:00Z');

describe('status do agendamento', () => {
  const later = new Date('2026-03-15T18:00:00Z');
  const earlier = new Date('2026-03-15T12:00:00Z');
  it('concluído e falta só depois do término', () => {
    expect(canTransition('CONFIRMED', 'COMPLETED', { endsAt: later, now }).ok).toBe(false);
    expect(canTransition('CONFIRMED', 'COMPLETED', { endsAt: earlier, now }).ok).toBe(true);
    expect(canTransition('CONFIRMED', 'NO_SHOW', { endsAt: later, now }).ok).toBe(false);
  });
  it('cancelado é final', () => {
    expect(canTransition('CANCELLED', 'CONFIRMED', { endsAt: earlier, now }).ok).toBe(false);
  });
  it('pendente pode ser aceito ou recusado', () => {
    expect(canTransition('PENDING', 'CONFIRMED', { endsAt: later, now }).ok).toBe(true);
    expect(canTransition('PENDING', 'CANCELLED', { endsAt: later, now }).ok).toBe(true);
  });
  it('cliente cancela livremente antes do horário', () => {
    expect(clientCanCancel('CONFIRMED', later, now)).toBe(true);
    expect(clientCanCancel('CONFIRMED', earlier, now)).toBe(false);
    expect(clientCanCancel('COMPLETED', later, now)).toBe(false);
  });
});

describe('planos', () => {
  it('teste vale o plano completo por 7 dias', () => {
    const s = planState({ plan: 'essencial', status: 'TRIALING', trialEndsAt: new Date('2026-03-20T00:00:00Z'), currentPeriodEnd: null }, now);
    expect(s.active).toBe(true);
    expect(s.trialDaysLeft).toBe(5);
    expect(hasFeature(s, 'reports')).toBe(true);
  });
  it('teste vencido bloqueia tudo', () => {
    const s = planState({ plan: 'equipe', status: 'TRIALING', trialEndsAt: new Date('2026-03-10T00:00:00Z'), currentPeriodEnd: null }, now);
    expect(s.active).toBe(false);
    expect(hasFeature(s, 'cash')).toBe(false);
  });
  it('Essencial não tem relatórios nem equipe', () => {
    const s = planState({ plan: 'essencial', status: 'ACTIVE', trialEndsAt: now, currentPeriodEnd: new Date('2026-04-01T00:00:00Z') }, now);
    expect(hasFeature(s, 'reports')).toBe(false);
    expect(hasFeature(s, 'whatsapp_qr')).toBe(true);
    expect(canAddProfessional(s, 1)).toBe(false);
  });
  it('cancelado vale até o fim do período', () => {
    const s = planState({ plan: 'equipe', status: 'CANCELED', trialEndsAt: now, currentPeriodEnd: new Date('2026-03-20T00:00:00Z') }, now);
    expect(s.active).toBe(true);
    expect(canAddProfessional(s, 4)).toBe(true);
    expect(canAddProfessional(s, 5)).toBe(false);
  });
});

describe('permissões', () => {
  it('barbeiro só mexe na própria agenda', () => {
    expect(can({ role: 'BARBER' }, 'agenda.all')).toBe(false);
    expect(can({ role: 'BARBER' }, 'agenda.own')).toBe(true);
    expect(can({ role: 'BARBER' }, 'settings')).toBe(false);
    expect(can({ role: 'BARBER', canManageOwnServices: true }, 'services.manage')).toBe(true);
  });
  it('recepcionista opera a agenda de todos e o caixa, mas não a equipe', () => {
    expect(can({ role: 'RECEPTIONIST' }, 'agenda.all')).toBe(true);
    expect(can({ role: 'RECEPTIONIST' }, 'cash')).toBe(true);
    expect(can({ role: 'RECEPTIONIST' }, 'team')).toBe(false);
  });
});

describe('comissão', () => {
  const prod = { serviceRevenueCents: 100000, serviceCount: 20, productRevenueCents: 10000 };
  it('percentual por serviço', () => {
    expect(computeCommission({ type: 'PERCENT', value: 4000, productPercent: 1000 }, prod)).toEqual({ professionalCents: 41000, shopCents: 69000 });
  });
  it('valor fixo por serviço', () => {
    expect(computeCommission({ type: 'FIXED', value: 1500, productPercent: 0 }, prod)).toEqual({ professionalCents: 30000, shopCents: 80000 });
  });
  it('aluguel de cadeira', () => {
    expect(computeCommission({ type: 'CHAIR_RENT', value: 80000, productPercent: 0 }, prod)).toEqual({ professionalCents: 100000, shopCents: 90000 });
  });
});

describe('fidelidade e cupons', () => {
  it('conta selos', () => {
    expect(hasReward(10, { enabled: true, stampsRequired: 10 })).toBe(true);
    expect(stampsToReward(7, { enabled: true, stampsRequired: 10 })).toBe(3);
  });
  it('valida e aplica cupom', () => {
    expect(couponProblem({ type: 'PERCENT', value: 1000, active: true, validUntil: null, maxUses: 1, uses: 1 }, now)).toBe('Cupom esgotado.');
    expect(couponDiscount({ type: 'PERCENT', value: 1000 }, 5000)).toBe(500);
    expect(couponDiscount({ type: 'FIXED', value: 9000 }, 5000)).toBe(5000);
  });
});

describe('formatos brasileiros', () => {
  it('dinheiro', () => {
    expect(formatBRL(4500)).toBe('R$ 45,00');
    expect(parseBRL('1.045,50')).toBe(104550);
    expect(parseBRL('45')).toBe(4500);
    expect(parseBRL('abc')).toBeNull();
  });
  it('telefone com 9º dígito automático', () => {
    expect(normalizePhone('(11) 8765-4321')).toBe('5511987654321');
    expect(normalizePhone('+55 11 98765-4321')).toBe('5511987654321');
    expect(normalizePhone('11 3456-7890')).toBe('551134567890');
    expect(normalizePhone('(20) 98765-4321')).toBeNull();
    expect(normalizePhone('+1 415 555 0100')).toBe('14155550100');
    expect(formatPhone('5511987654321')).toBe('(11) 98765-4321');
  });
  it('CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });
  it('slug', () => {
    expect(slugify('Barbearia do Zé & Cia')).toBe('barbearia-do-ze-cia');
    expect(isValidSlug('painel')).toBe(false);
    expect(isValidSlug('barbearia-do-ze')).toBe(true);
  });
});

describe('mensagens', () => {
  it('troca variáveis e mantém as desconhecidas', () => {
    expect(renderTemplate('Oi {nome}, {x}', { nome: 'Ana' })).toBe('Oi Ana, {x}');
  });
  it('planeja lembrete e véspera', () => {
    const startsAt = new Date('2026-03-17T17:00:00Z'); // 14h em SP
    const r = planReminders(startsAt, 'America/Sao_Paulo', { reminderEnabled: true, hoursBefore: 3, eveEnabled: true, eveHour: 20 }, now);
    expect(r.map((x) => [x.kind, x.sendAt.toISOString()])).toEqual([
      ['REMINDER_EVE', '2026-03-16T23:00:00.000Z'],
      ['REMINDER', '2026-03-17T14:00:00.000Z'],
    ]);
  });
  it('não agenda lembrete no passado', () => {
    const startsAt = new Date('2026-03-15T16:00:00Z');
    expect(planReminders(startsAt, 'America/Sao_Paulo', { reminderEnabled: true, hoursBefore: 3, eveEnabled: true, eveHour: 20 }, now)).toEqual([]);
  });
});
