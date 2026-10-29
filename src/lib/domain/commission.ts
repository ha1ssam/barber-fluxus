import { percentOf } from './money';

export type CommissionType = 'NONE' | 'PERCENT' | 'FIXED' | 'CHAIR_RENT';

export interface CommissionRule {
  type: CommissionType;
  /** PERCENT: centésimos de %; FIXED: centavos por serviço; CHAIR_RENT: centavos por mês */
  value: number;
  /** centésimos de % sobre produtos vendidos pelo profissional */
  productPercent: number;
}

export interface ProfessionalProduction {
  serviceRevenueCents: number;
  serviceCount: number;
  productRevenueCents: number;
}

export interface CommissionResult {
  /** quanto o profissional recebe */
  professionalCents: number;
  /** quanto fica com a loja (no aluguel de cadeira, o aluguel devido) */
  shopCents: number;
}

export function computeCommission(rule: CommissionRule, p: ProfessionalProduction): CommissionResult {
  const total = p.serviceRevenueCents + p.productRevenueCents;
  const productPart = percentOf(p.productRevenueCents, rule.productPercent);
  switch (rule.type) {
    case 'PERCENT': {
      const pro = percentOf(p.serviceRevenueCents, rule.value) + productPart;
      return { professionalCents: pro, shopCents: total - pro };
    }
    case 'FIXED': {
      const pro = Math.min(p.serviceRevenueCents, p.serviceCount * rule.value) + productPart;
      return { professionalCents: pro, shopCents: total - pro };
    }
    case 'CHAIR_RENT':
      // O profissional fica com os serviços e paga um aluguel fixo; produtos seguem a % de produtos.
      return {
        professionalCents: p.serviceRevenueCents + productPart,
        shopCents: rule.value + (p.productRevenueCents - productPart),
      };
    case 'NONE':
    default:
      return { professionalCents: 0, shopCents: total };
  }
}

export const COMMISSION_LABELS: Record<CommissionType, string> = {
  NONE: 'Sem comissão',
  PERCENT: 'Percentual por serviço',
  FIXED: 'Valor fixo por serviço',
  CHAIR_RENT: 'Aluguel de cadeira',
};
