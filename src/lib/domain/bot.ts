// Robô de atendimento do WhatsApp. Puro: recebe o texto e o contexto, devolve respostas e uma ação.
// O estado fica no banco (BotConversation), não na memória do processo.

export interface BotContext {
  shopName: string;
  bookingLink: string;
  nextAppointment?: { id: string; label: string; status: 'PENDING' | 'CONFIRMED' };
}

export type BotStep = 'MENU' | 'AWAIT_CANCEL_CONFIRM';

export interface BotState {
  step: BotStep;
}

export type BotAction =
  | { type: 'confirm'; appointmentId: string }
  | { type: 'cancel'; appointmentId: string }
  | { type: 'handoff' };

export interface BotResult {
  replies: string[];
  state: BotState;
  action?: BotAction;
}

export const HUMAN_HANDOFF_MINUTES = 30;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function menuText(ctx: BotContext): string {
  return [
    `Olá! 👋 Você está falando com a ${ctx.shopName}. Escolha uma opção:`,
    '',
    '1️⃣ Fazer agendamento',
    '2️⃣ Ver ou confirmar meu horário',
    '3️⃣ Cancelar meu horário',
    '4️⃣ Falar com atendente',
  ].join('\n');
}

const YES = ['sim', 's', 'confirmar', 'confirmo', 'ok'];
const CANCEL = ['cancelar', 'cancela', 'desmarcar'];

export function handleBotMessage(text: string, state: BotState | null, ctx: BotContext): BotResult {
  const t = normalize(text);
  const menu: BotState = { step: 'MENU' };
  const next = ctx.nextAppointment;

  if (state?.step === 'AWAIT_CANCEL_CONFIRM') {
    if (next && (YES.includes(t) || CANCEL.includes(t))) {
      return { replies: ['Pronto, seu horário foi cancelado. Quando quiser marcar outro: ' + ctx.bookingLink], state: menu, action: { type: 'cancel', appointmentId: next.id } };
    }
    if (t === 'nao' || t === 'n' || t === 'voltar') {
      return { replies: ['Tudo certo, seu horário continua marcado.'], state: menu };
    }
  }

  // Respostas diretas aos lembretes.
  if (YES.includes(t)) {
    if (!next) return { replies: ['Você não tem horário marcado. Para agendar: ' + ctx.bookingLink], state: menu };
    if (next.status === 'CONFIRMED') return { replies: [`Seu horário já está confirmado: ${next.label}. Até lá! ✂️`], state: menu };
    return { replies: [`Confirmado! ✅ Te esperamos ${next.label}.`], state: menu, action: { type: 'confirm', appointmentId: next.id } };
  }
  if (CANCEL.includes(t)) {
    if (!next) return { replies: ['Você não tem horário para cancelar.'], state: menu };
    return { replies: ['Pronto, seu horário foi cancelado. Quando quiser marcar outro: ' + ctx.bookingLink], state: menu, action: { type: 'cancel', appointmentId: next.id } };
  }

  if (t === '1' || /\b(agendar|marcar|horario|agenda)\b/.test(t)) {
    return { replies: [`📅 Escolha serviço, dia e horário por aqui: ${ctx.bookingLink}`], state: menu };
  }
  if (t === '2') {
    if (!next) return { replies: ['Você não tem horário marcado. Para agendar: ' + ctx.bookingLink], state: menu };
    const extra = next.status === 'PENDING' ? '\nResponda SIM para confirmar.' : '';
    return { replies: [`Seu próximo horário: ${next.label}.${extra}`], state: menu };
  }
  if (t === '3') {
    if (!next) return { replies: ['Você não tem horário para cancelar.'], state: menu };
    return { replies: [`Quer mesmo cancelar ${next.label}? Responda SIM para cancelar ou NÃO para manter.`], state: { step: 'AWAIT_CANCEL_CONFIRM' } };
  }
  if (t === '4' || /\b(atendente|humano|pessoa)\b/.test(t)) {
    return { replies: ['Certo! Um atendente vai te responder em instantes.'], state: menu, action: { type: 'handoff' } };
  }
  return { replies: [menuText(ctx)], state: menu };
}
