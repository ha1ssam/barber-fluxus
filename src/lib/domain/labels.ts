export const CATEGORY_LABELS: Record<string, string> = {
  HAIRCUT: 'Corte',
  BEARD: 'Barba',
  EYEBROW: 'Sobrancelha',
  COMBO: 'Combo',
  HAIR: 'Cabelo (química, pigmentação)',
  NAILS: 'Unhas',
  SKIN: 'Pele e estética',
  OTHER: 'Outro',
};

export const CATEGORY_ICONS: Record<string, 'cut' | 'face' | 'sparkles' | 'star' | 'purchase-tag'> = {
  HAIRCUT: 'cut',
  BEARD: 'face',
  EYEBROW: 'face',
  COMBO: 'star',
  HAIR: 'sparkles',
  NAILS: 'sparkles',
  SKIN: 'sparkles',
  OTHER: 'purchase-tag',
};

export const PAYMENT_OPTIONS: Record<string, string> = { cash: 'Dinheiro', pix: 'PIX', credit: 'Cartão de crédito', debit: 'Cartão de débito' };

export const AMENITY_OPTIONS: Record<string, string> = {
  wifi: 'Wi-Fi',
  estacionamento: 'Estacionamento',
  ar: 'Ar-condicionado',
  cafe: 'Café',
  cerveja: 'Cerveja',
  acessibilidade: 'Acessibilidade',
  tv: 'TV',
  kids: 'Atende crianças',
  agua: 'Água',
};

export const BUSINESS_LABELS: Record<string, string> = {
  BARBERSHOP: 'Barbearia',
  SALON: 'Salão de beleza',
  AESTHETICS: 'Estética',
  NAILS: 'Manicure e unhas',
  OTHER: 'Negócio de beleza',
};

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}
