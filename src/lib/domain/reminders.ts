import { addDays, utcToZoned, zonedToUtc } from './time';

export interface ReminderConfig {
  reminderEnabled: boolean;
  hoursBefore: number;
  eveEnabled: boolean;
  eveHour: number;
}

export interface PlannedReminder {
  kind: 'REMINDER' | 'REMINDER_EVE';
  sendAt: Date;
}

/** Quando mandar os lembretes de um agendamento. Nada é agendado no passado. */
export function planReminders(startsAt: Date, tz: string, cfg: ReminderConfig, now: Date): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  let reminderAt: Date | null = null;
  if (cfg.reminderEnabled && cfg.hoursBefore > 0) {
    const at = new Date(startsAt.getTime() - cfg.hoursBefore * 3_600_000);
    if (at > now) {
      reminderAt = at;
      out.push({ kind: 'REMINDER', sendAt: at });
    }
  }
  if (cfg.eveEnabled) {
    const local = utcToZoned(startsAt, tz);
    const eve = zonedToUtc(addDays(local.date, -1), cfg.eveHour * 60, tz);
    // Só faz sentido se for antes do lembrete principal e ainda no futuro.
    if (eve > now && (!reminderAt || eve < reminderAt)) out.push({ kind: 'REMINDER_EVE', sendAt: eve });
  }
  return out.sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
}
