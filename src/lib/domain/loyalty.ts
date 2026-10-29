export interface LoyaltyConfig {
  enabled: boolean;
  stampsRequired: number;
}

export function hasReward(stamps: number, cfg: LoyaltyConfig): boolean {
  return cfg.enabled && cfg.stampsRequired > 0 && stamps >= cfg.stampsRequired;
}

/** Quantos selos faltam para o próximo prêmio. */
export function stampsToReward(stamps: number, cfg: LoyaltyConfig): number {
  if (!cfg.enabled || cfg.stampsRequired <= 0) return 0;
  return Math.max(0, cfg.stampsRequired - stamps);
}

export interface CouponLike {
  type: 'PERCENT' | 'FIXED';
  value: number;
  active: boolean;
  validUntil: Date | null;
  maxUses: number | null;
  uses: number;
}

export function couponProblem(c: CouponLike, now: Date): string | null {
  if (!c.active) return 'Cupom desativado.';
  if (c.validUntil && c.validUntil < now) return 'Cupom vencido.';
  if (c.maxUses !== null && c.uses >= c.maxUses) return 'Cupom esgotado.';
  return null;
}

export function couponDiscount(c: Pick<CouponLike, 'type' | 'value'>, subtotalCents: number): number {
  const raw = c.type === 'PERCENT' ? Math.round((subtotalCents * c.value) / 10000) : c.value;
  return Math.max(0, Math.min(subtotalCents, raw));
}

/** Código de indicação curto e fácil de ditar (sem 0/O/1/I). */
export function generateReferralCode(random: () => number = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(random() * alphabet.length)];
  return out;
}
