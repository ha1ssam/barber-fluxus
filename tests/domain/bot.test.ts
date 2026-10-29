import { describe, expect, it } from 'vitest';
import { handleBotMessage, type BotContext } from '@/lib/domain/bot';

const ctx: BotContext = {
  shopName: 'Barbearia do Zé',
  bookingLink: 'https://x/ze',
  nextAppointment: { id: 'a1', label: '15/03 às 14:00', status: 'PENDING' },
};

describe('robô do WhatsApp', () => {
  it('qualquer mensagem mostra o menu', () => {
    const r = handleBotMessage('oi', null, ctx);
    expect(r.replies[0]).toContain('1️⃣');
    expect(r.action).toBeUndefined();
  });
  it('SIM confirma o próximo horário', () => {
    expect(handleBotMessage('Sim', null, ctx).action).toEqual({ type: 'confirm', appointmentId: 'a1' });
  });
  it('CANCELAR cancela direto (resposta ao lembrete)', () => {
    expect(handleBotMessage('CANCELAR', null, ctx).action).toEqual({ type: 'cancel', appointmentId: 'a1' });
  });
  it('opção 3 pede confirmação antes de cancelar', () => {
    const r1 = handleBotMessage('3', null, ctx);
    expect(r1.action).toBeUndefined();
    const r2 = handleBotMessage('sim', r1.state, ctx);
    expect(r2.action).toEqual({ type: 'cancel', appointmentId: 'a1' });
    expect(handleBotMessage('não', r1.state, ctx).action).toBeUndefined();
  });
  it('agendar manda o link', () => {
    expect(handleBotMessage('quero marcar', null, ctx).replies[0]).toContain('https://x/ze');
  });
  it('atendente pausa o robô', () => {
    expect(handleBotMessage('4', null, ctx).action).toEqual({ type: 'handoff' });
  });
  it('sem horário marcado não confirma nada', () => {
    expect(handleBotMessage('sim', null, { ...ctx, nextAppointment: undefined }).action).toBeUndefined();
  });
});
