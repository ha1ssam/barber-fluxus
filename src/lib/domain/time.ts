// Datas e horas no fuso da loja, sem dependências.
// Convenção: "date" é AAAA-MM-DD no fuso da loja; "minute" é minutos desde 00:00 local.

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function parts(utc: Date, tz: string) {
  const out: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(utc)) out[p.type] = p.value;
  return out;
}

/** Diferença em minutos entre o horário local e o UTC naquele instante (São Paulo = -180). */
export function tzOffsetMinutes(utc: Date, tz: string): number {
  const p = parts(utc, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(utc.getTime() / 1000) * 1000) / 60000);
}

/** Converte data + minuto local da loja para um instante UTC. */
export function zonedToUtc(date: string, minute: number, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minute);
  const off1 = tzOffsetMinutes(new Date(guess), tz);
  let utc = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(new Date(utc), tz);
  if (off2 !== off1) utc = guess - off2 * 60000;
  return new Date(utc);
}

export interface ZonedParts {
  date: string;
  minute: number;
  weekday: number;
}

/** Converte um instante UTC para data, minuto e dia da semana no fuso da loja. */
export function utcToZoned(utc: Date, tz: string): ZonedParts {
  const p = parts(utc, tz);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minute: +p.hour * 60 + +p.minute,
    weekday: WEEKDAY_INDEX[p.weekday] ?? 0,
  };
}

export function todayIn(tz: string, now = new Date()): string {
  return utcToZoned(now, tz).date;
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Início (inclusivo) e fim (exclusivo) de um dia local, em UTC. */
export function dayRangeUtc(date: string, tz: string): { start: Date; end: Date } {
  return { start: zonedToUtc(date, 0, tz), end: zonedToUtc(addDays(date, 1), 0, tz) };
}

export function minuteToHHMM(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinute(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

/** "15/03/2026" */
export function formatDateBR(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/** "15/03" */
export function formatDayMonth(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

const WEEKDAYS_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function weekdayLong(date: string): string {
  return WEEKDAYS_LONG[weekdayOf(date)];
}
export function weekdayShort(date: string): string {
  return WEEKDAYS_SHORT[weekdayOf(date)];
}

/** "15/03 às 14:00" no fuso da loja */
export function formatDateTimeBR(utc: Date, tz: string): string {
  const z = utcToZoned(utc, tz);
  return `${formatDayMonth(z.date)} às ${minuteToHHMM(z.minute)}`;
}

/** Primeiro dia (domingo) da semana que contém a data. */
export function startOfWeek(date: string): string {
  return addDays(date, -weekdayOf(date));
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(date: string, months: number): string {
  const [y, m] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  return dt.toISOString().slice(0, 10);
}
