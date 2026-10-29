// Planos e recursos num lugar só. O modelo de cobrança ainda está em aberto na spec (item 3),
// então preço e limites ficam aqui para mudar sem mexer no resto do código.

export type PlanId = 'essencial' | 'equipe';

export type Feature =
  | 'whatsapp_qr'
  | 'whatsapp_cloud'
  | 'auto_messages'
  | 'cash'
  | 'commission'
  | 'loyalty'
  | 'reports'
  | 'team';

export interface Plan {
  id: PlanId;
  name: string;
  priceCents: number;
  maxProfessionals: number;
  tagline: string;
  features: Feature[];
  highlights: string[];
}

export const TRIAL_DAYS = 7;

export const PLANS: Record<PlanId, Plan> = {
  essencial: {
    id: 'essencial',
    name: 'Essencial',
    priceCents: 3990,
    maxProfessionals: 1,
    tagline: 'Para o profissional autônomo',
    features: ['whatsapp_qr', 'auto_messages', 'cash', 'loyalty'],
    highlights: [
      'Agenda e página de agendamento',
      'WhatsApp por QR Code',
      'Lembretes e mensagens automáticas',
      'Caixa do dia e venda de produtos',
      'Cartão fidelidade, cupons e indicação',
    ],
  },
  equipe: {
    id: 'equipe',
    name: 'Equipe',
    priceCents: 11990,
    maxProfessionals: 5,
    tagline: 'Para lojas com até 5 profissionais',
    features: ['whatsapp_qr', 'whatsapp_cloud', 'auto_messages', 'cash', 'commission', 'loyalty', 'reports', 'team'],
    highlights: [
      'Tudo do Essencial',
      'Até 5 profissionais e recepcionistas',
      'Comissão por profissional',
      'Relatórios com comparação de período',
      'WhatsApp pela API oficial da Meta',
    ],
  },
};

export const FEATURE_LABELS: Record<Feature, string> = {
  whatsapp_qr: 'WhatsApp por QR Code',
  whatsapp_cloud: 'WhatsApp pela API oficial',
  auto_messages: 'Mensagens automáticas',
  cash: 'Caixa',
  commission: 'Comissões',
  loyalty: 'Fidelidade',
  reports: 'Relatórios',
  team: 'Equipe',
};

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

export interface SubscriptionLike {
  plan: string;
  status: SubscriptionStatus;
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
}

export interface PlanState {
  plan: Plan;
  /** Plano cujos recursos valem agora (no teste vale o Equipe). */
  effectivePlan: Plan;
  active: boolean;
  trialing: boolean;
  trialDaysLeft: number;
  reason?: string;
}

export function isPlanId(v: string): v is PlanId {
  return v === 'essencial' || v === 'equipe';
}

export function planState(sub: SubscriptionLike | null, now = new Date()): PlanState {
  const plan = PLANS[sub && isPlanId(sub.plan) ? sub.plan : 'essencial'];
  if (!sub) {
    return { plan, effectivePlan: plan, active: false, trialing: false, trialDaysLeft: 0, reason: 'Sem assinatura.' };
  }
  if (sub.status === 'TRIALING') {
    const msLeft = sub.trialEndsAt.getTime() - now.getTime();
    const active = msLeft > 0;
    return {
      plan,
      effectivePlan: PLANS.equipe,
      active,
      trialing: active,
      trialDaysLeft: active ? Math.ceil(msLeft / 86_400_000) : 0,
      reason: active ? undefined : 'Seu período de teste terminou.',
    };
  }
  if (sub.status === 'ACTIVE' || sub.status === 'CANCELED') {
    // Cancelado continua valendo até o fim do período pago.
    const active = !!sub.currentPeriodEnd && sub.currentPeriodEnd > now;
    return {
      plan,
      effectivePlan: plan,
      active,
      trialing: false,
      trialDaysLeft: 0,
      reason: active ? undefined : 'Sua assinatura venceu.',
    };
  }
  return { plan, effectivePlan: plan, active: false, trialing: false, trialDaysLeft: 0, reason: 'Pagamento pendente.' };
}

export function hasFeature(state: PlanState, feature: Feature): boolean {
  return state.active && state.effectivePlan.features.includes(feature);
}

export function canAddProfessional(state: PlanState, currentProfessionals: number): boolean {
  return state.active && currentProfessionals < state.effectivePlan.maxProfessionals;
}
