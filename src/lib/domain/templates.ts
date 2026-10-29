// Mensagens automáticas do WhatsApp. Emoji só aqui (regra do UI kit).
import type { MessageKindName } from './message-kinds';

export type TemplateVars = Partial<
  Record<'nome' | 'loja' | 'data' | 'hora' | 'servicos' | 'profissional' | 'link' | 'valor' | 'premio' | 'endereco', string>
>;

export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = vars[key as keyof TemplateVars];
    return v !== undefined ? v : match;
  });
}

export const DEFAULT_TEMPLATES: Record<MessageKindName, { label: string; description: string; body: string }> = {
  BOOKING_RECEIVED: {
    label: 'Reserva recebida',
    description: 'Quando o cliente reserva e a loja ainda precisa confirmar.',
    body: 'Olá, {nome}! 👋 Recebemos sua reserva na {loja} para {data} às {hora} ({servicos}). Assim que confirmarmos, avisamos por aqui.\n\nVer ou cancelar: {link}',
  },
  CONFIRMATION: {
    label: 'Confirmação',
    description: 'Quando o agendamento é confirmado.',
    body: '✅ {nome}, seu horário na {loja} está confirmado: {data} às {hora} com {profissional}.\n✂️ {servicos}\n\nPrecisa cancelar? {link}',
  },
  CANCELLATION: {
    label: 'Cancelamento',
    description: 'Quando a loja cancela ou recusa o horário.',
    body: '{nome}, seu horário de {data} às {hora} na {loja} foi cancelado. Para marcar outro: {link}',
  },
  REMINDER: {
    label: 'Lembrete',
    description: 'Algumas horas antes do horário. O cliente responde SIM ou CANCELAR.',
    body: '💈 Lembrete: {nome}, você tem horário hoje às {hora} na {loja}.\nResponda SIM para confirmar ou CANCELAR para desmarcar.',
  },
  REMINDER_EVE: {
    label: 'Lembrete da véspera',
    description: 'Na véspera, no horário configurado.',
    body: '📅 {nome}, amanhã você tem horário às {hora} na {loja} ({servicos}).\nResponda SIM para confirmar ou CANCELAR para desmarcar.',
  },
  REVIEW_REQUEST: {
    label: 'Pedido de avaliação',
    description: 'Depois que o atendimento é concluído.',
    body: 'Obrigado pela visita, {nome}! ✂️ Como foi seu atendimento na {loja}? Sua avaliação leva 10 segundos: {link}',
  },
  BIRTHDAY: {
    label: 'Aniversário',
    description: 'No dia do aniversário do cliente, às 10h.',
    body: '🎉 Feliz aniversário, {nome}! A equipe da {loja} deseja um ótimo dia. Que tal comemorar com um horário? {link}',
  },
  WINBACK: {
    label: 'Cliente sumido',
    description: 'Quando o cliente passa do prazo sem voltar.',
    body: 'Oi, {nome}! Faz tempo que você não aparece na {loja}. 💈 Bora marcar? {link}',
  },
  WAITLIST: {
    label: 'Fila de espera',
    description: 'Quando abre um horário no dia em que o cliente está na fila.',
    body: '{nome}, abriu um horário na {loja} em {data}! Corre para garantir: {link}',
  },
  BOT: {
    label: 'Robô',
    description: 'Respostas do robô de atendimento.',
    body: '',
  },
};

export const CONFIGURABLE_TEMPLATES: MessageKindName[] = [
  'BOOKING_RECEIVED',
  'CONFIRMATION',
  'CANCELLATION',
  'REMINDER',
  'REMINDER_EVE',
  'REVIEW_REQUEST',
  'BIRTHDAY',
  'WINBACK',
  'WAITLIST',
];
