import { describe, expect, it } from 'vitest';
import { availableSlots, checkSlot, groupByPeriod, sumServices, type AvailabilityInput } from '@/lib/domain/availability';
import { minuteToHHMM } from '@/lib/domain/time';

const h = (s: string) => {
  const [a, b] = s.split(':').map(Number);
  return a * 60 + b;
};
const base: AvailabilityInput = {
  shifts: [
    { start: h('09:00'), end: h('12:00') },
    { start: h('13:00'), end: h('18:00') },
  ],
  appointments: [],
  blocks: [],
  durationMinutes: 30,
  slotInterval: 30,
};
const fmt = (slots: number[]) => slots.map(minuteToHHMM);

describe('horários livres', () => {
  it('gera a grade nos dois turnos e respeita o almoço', () => {
    const slots = fmt(availableSlots(base));
    expect(slots[0]).toBe('09:00');
    expect(slots).toContain('11:30');
    expect(slots).not.toContain('12:00');
    expect(slots).not.toContain('12:30');
    expect(slots).toContain('13:00');
    expect(slots[slots.length - 1]).toBe('17:30');
  });

  it('só mostra horário em que cabe a duração total', () => {
    const slots = fmt(availableSlots({ ...base, durationMinutes: 60 }));
    expect(slots).toContain('11:00');
    expect(slots).not.toContain('11:30');
    expect(slots).not.toContain('17:30');
  });

  it('respeita grade configurável de 15 minutos', () => {
    const slots = fmt(availableSlots({ ...base, slotInterval: 15 }));
    expect(slots.slice(0, 3)).toEqual(['09:00', '09:15', '09:30']);
  });

  it('não bate com agendamento nem bloqueio', () => {
    const slots = fmt(
      availableSlots({
        ...base,
        appointments: [{ start: h('10:00'), end: h('10:45') }],
        blocks: [{ start: h('15:00'), end: h('16:00') }],
      }),
    );
    expect(slots).toContain('09:30');
    expect(slots).not.toContain('10:00');
    expect(slots).not.toContain('10:30');
    expect(slots).toContain('11:00');
    expect(slots).not.toContain('15:00');
    expect(slots).not.toContain('15:30');
    expect(slots).toContain('16:00');
  });

  it('aplica o intervalo entre clientes', () => {
    const input = { ...base, bufferMinutes: 10, appointments: [{ start: h('10:00'), end: h('10:30') }] };
    expect(checkSlot(input, h('10:30'))).toEqual({ ok: false, reason: 'conflict' });
    expect(checkSlot(input, h('10:40'))).toEqual({ ok: true });
    expect(checkSlot(input, h('09:30'))).toEqual({ ok: false, reason: 'conflict' });
  });

  it('esconde horários antes de agora + antecedência', () => {
    const slots = fmt(availableSlots({ ...base, notBeforeMinute: h('14:10') }));
    expect(slots[0]).toBe('14:30');
  });

  it('valida no servidor: fora do expediente é recusado, salvo encaixe manual', () => {
    expect(checkSlot(base, h('12:00'))).toEqual({ ok: false, reason: 'outside_hours' });
    expect(checkSlot(base, h('12:10'), { allowOutsideHours: true })).toEqual({ ok: true });
    expect(checkSlot(base, h('17:45'))).toEqual({ ok: false, reason: 'outside_hours' });
  });

  it('dia sem expediente não tem horário', () => {
    expect(availableSlots({ ...base, shifts: [] })).toEqual([]);
  });

  it('agrupa por período', () => {
    const groups = groupByPeriod([h('09:00'), h('13:00'), h('18:30')]);
    expect(groups.map((g) => g.period)).toEqual(['morning', 'afternoon', 'evening']);
  });

  it('soma serviços (corte + barba)', () => {
    expect(sumServices([{ priceCents: 4500, durationMinutes: 30 }, { priceCents: 3000, durationMinutes: 20 }])).toEqual({
      priceCents: 7500,
      durationMinutes: 50,
    });
  });
});
