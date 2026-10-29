const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 4500 → "R$ 45,00" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, ' ');
}

/** "45", "45,5", "45,50", "R$ 1.045,50" → centavos. Retorna null se inválido. */
export function parseBRL(input: string): number | null {
  const cleaned = input.replace(/R\$\s?/i, '').replace(/\s/g, '').trim();
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(',')) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** 4000 (centésimos de %) → "40%" */
export function formatPercent(basisPoints: number): string {
  const v = basisPoints / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(1).replace('.', ',')}%`;
}

export function percentOf(cents: number, basisPoints: number): number {
  return Math.round((cents * basisPoints) / 10000);
}
