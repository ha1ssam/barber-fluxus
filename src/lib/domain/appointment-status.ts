export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

/** Status que ocupam a agenda. */
export const ACTIVE_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED'];

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  // Correção de engano: quem foi marcado como falta pode virar concluído.
  NO_SHOW: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  ctx: { endsAt: Date; now: Date },
): { ok: true } | { ok: false; error: string } {
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, error: `Não é possível mudar de ${STATUS_LABELS[from]} para ${STATUS_LABELS[to]}.` };
  }
  if ((to === 'COMPLETED' || to === 'NO_SHOW') && ctx.now < ctx.endsAt) {
    return {
      ok: false,
      error:
        to === 'COMPLETED'
          ? 'O agendamento só pode ser concluído após o horário de término.'
          : 'A falta só pode ser marcada após o horário de término.',
    };
  }
  return { ok: true };
}

/** O cliente pode cancelar sozinho enquanto estiver pendente ou confirmado e ainda não tiver começado. */
export function clientCanCancel(status: AppointmentStatus, startsAt: Date, now: Date): boolean {
  return ACTIVE_STATUSES.includes(status) && startsAt > now;
}
