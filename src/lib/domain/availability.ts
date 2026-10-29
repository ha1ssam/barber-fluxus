// Cálculo de horários livres. Funções puras: o chamador busca expediente, agendamentos e bloqueios.

export interface Interval {
  /** minutos desde 00:00 local (inclusivo) */
  start: number;
  /** minutos desde 00:00 local (exclusivo) */
  end: number;
}

export interface AvailabilityInput {
  /** Turnos de trabalho do dia. O intervalo entre turnos é o almoço. */
  shifts: Interval[];
  /** Agendamentos pendentes ou confirmados do profissional nesse dia. */
  appointments: Interval[];
  /** Bloqueios do profissional nesse dia. */
  blocks: Interval[];
  /** Duração somada dos serviços escolhidos. */
  durationMinutes: number;
  /** Passo da grade: 10, 15, 20 ou 30. */
  slotInterval: number;
  /** Intervalo mínimo entre um cliente e outro. */
  bufferMinutes?: number;
  /** Primeiro minuto aceitável (para hoje: agora + antecedência mínima). */
  notBeforeMinute?: number;
}

export const ALLOWED_SLOT_INTERVALS = [10, 15, 20, 30] as const;

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Junta e ordena turnos, descartando inválidos. */
export function normalizeShifts(shifts: Interval[]): Interval[] {
  const sorted = shifts.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

export type SlotRejection = 'outside_hours' | 'conflict' | 'too_soon' | 'invalid';

/**
 * Diz se um início específico cabe. Usado tanto na grade quanto na validação do servidor.
 * `allowOutsideHours` serve para o encaixe manual do barbeiro.
 */
export function checkSlot(
  input: AvailabilityInput,
  start: number,
  opts: { allowOutsideHours?: boolean } = {},
): { ok: true } | { ok: false; reason: SlotRejection } {
  const duration = input.durationMinutes;
  if (!Number.isInteger(start) || duration <= 0 || start < 0 || start + duration > 24 * 60) {
    return { ok: false, reason: 'invalid' };
  }
  const candidate = { start, end: start + duration };
  if (input.notBeforeMinute !== undefined && start < input.notBeforeMinute) {
    return { ok: false, reason: 'too_soon' };
  }
  if (!opts.allowOutsideHours) {
    const fits = normalizeShifts(input.shifts).some((s) => start >= s.start && candidate.end <= s.end);
    if (!fits) return { ok: false, reason: 'outside_hours' };
  }
  const buffer = input.bufferMinutes ?? 0;
  for (const a of input.appointments) {
    if (overlaps(candidate, { start: a.start - buffer, end: a.end + buffer })) return { ok: false, reason: 'conflict' };
  }
  for (const b of input.blocks) {
    if (overlaps(candidate, b)) return { ok: false, reason: 'conflict' };
  }
  return { ok: true };
}

/** Gera os horários livres do dia, alinhados à grade a partir do início de cada turno. */
export function availableSlots(input: AvailabilityInput): number[] {
  const step = input.slotInterval;
  if (!step || step <= 0 || input.durationMinutes <= 0) return [];
  const out = new Set<number>();
  for (const shift of normalizeShifts(input.shifts)) {
    for (let t = shift.start; t + input.durationMinutes <= shift.end; t += step) {
      if (checkSlot(input, t).ok) out.add(t);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export type DayPeriod = 'morning' | 'afternoon' | 'evening';

export function periodOf(minute: number): DayPeriod {
  if (minute < 12 * 60) return 'morning';
  if (minute < 18 * 60) return 'afternoon';
  return 'evening';
}

export const PERIOD_LABELS: Record<DayPeriod, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite',
};

export function groupByPeriod(slots: number[]): { period: DayPeriod; slots: number[] }[] {
  const groups: Record<DayPeriod, number[]> = { morning: [], afternoon: [], evening: [] };
  for (const s of slots) groups[periodOf(s)].push(s);
  return (Object.keys(groups) as DayPeriod[])
    .filter((p) => groups[p].length > 0)
    .map((p) => ({ period: p, slots: groups[p] }));
}

/** Soma duração e preço de vários serviços (corte + barba). */
export function sumServices(services: { priceCents: number; durationMinutes: number }[]) {
  return services.reduce(
    (acc, s) => ({ priceCents: acc.priceCents + s.priceCents, durationMinutes: acc.durationMinutes + s.durationMinutes }),
    { priceCents: 0, durationMinutes: 0 },
  );
}

/** Corta um intervalo UTC para os minutos do dia local (para agendamentos que cruzam a meia-noite). */
export function clipToDay(startMinuteOfDay: number, durationMinutes: number): Interval {
  return { start: Math.max(0, startMinuteOfDay), end: Math.min(24 * 60, startMinuteOfDay + durationMinutes) };
}
