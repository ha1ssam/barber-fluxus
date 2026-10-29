// Telefones guardados só com dígitos e DDI: 5511987654321.

const BR_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Normaliza um telefone. Números brasileiros sem DDI ganham 55; celulares com 8 dígitos ganham o 9.
 * Números com "+" e outro DDI são aceitos como internacionais (8 a 15 dígitos).
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  const international = raw.startsWith('+') || raw.startsWith('00');
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('00')) digits = digits.slice(2);

  if (international && !digits.startsWith('55')) {
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1); // 0 de operadora/DDD
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = Number(digits.slice(0, 2));
  if (!BR_DDDS.has(ddd)) return null;
  let local = digits.slice(2);
  if (local.length === 8 && /^[6-9]/.test(local)) local = `9${local}`;
  if (local.length === 9 && !local.startsWith('9')) return null;
  return `55${ddd}${local}`;
}

/** 5511987654321 → "(11) 98765-4321" */
export function formatPhone(normalized: string): string {
  if (normalized.startsWith('55') && (normalized.length === 12 || normalized.length === 13)) {
    const ddd = normalized.slice(2, 4);
    const local = normalized.slice(4);
    const split = local.length - 4;
    return `(${ddd}) ${local.slice(0, split)}-${local.slice(split)}`;
  }
  return `+${normalized}`;
}

export function whatsappLink(normalized: string, text?: string): string {
  return `https://wa.me/${normalized}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
