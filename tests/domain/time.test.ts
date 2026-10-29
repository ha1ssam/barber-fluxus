import { describe, expect, it } from 'vitest';
import { addDays, dayRangeUtc, hhmmToMinute, isValidDate, minuteToHHMM, startOfWeek, utcToZoned, weekdayOf, zonedToUtc } from '@/lib/domain/time';

const SP = 'America/Sao_Paulo';

describe('fuso horário', () => {
  it('converte horário local de São Paulo para UTC (UTC-3)', () => {
    expect(zonedToUtc('2026-03-15', 14 * 60, SP).toISOString()).toBe('2026-03-15T17:00:00.000Z');
  });
  it('volta de UTC para local', () => {
    expect(utcToZoned(new Date('2026-03-15T17:30:00Z'), SP)).toEqual({ date: '2026-03-15', minute: 14 * 60 + 30, weekday: 0 });
  });
  it('lida com fuso de loja fora de São Paulo', () => {
    expect(zonedToUtc('2026-03-15', 9 * 60, 'America/Manaus').toISOString()).toBe('2026-03-15T13:00:00.000Z');
  });
  it('lida com horário de verão (Nova York)', () => {
    // 9h em NY no verão = 13h UTC; no inverno = 14h UTC
    expect(zonedToUtc('2026-07-01', 9 * 60, 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(zonedToUtc('2026-01-05', 9 * 60, 'America/New_York').toISOString()).toBe('2026-01-05T14:00:00.000Z');
  });
  it('calcula o intervalo do dia em UTC', () => {
    const r = dayRangeUtc('2026-03-15', SP);
    expect(r.start.toISOString()).toBe('2026-03-15T03:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-03-16T03:00:00.000Z');
  });
});

describe('utilitários de data', () => {
  it('soma dias atravessando meses', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('valida datas', () => {
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('15/03/2026')).toBe(false);
  });
  it('converte horas', () => {
    expect(minuteToHHMM(9 * 60 + 5)).toBe('09:05');
    expect(hhmmToMinute('14:30')).toBe(870);
    expect(hhmmToMinute('25:00')).toBeNull();
  });
  it('acha o dia da semana e o domingo da semana', () => {
    expect(weekdayOf('2026-03-15')).toBe(0);
    expect(startOfWeek('2026-03-18')).toBe('2026-03-15');
  });
});
