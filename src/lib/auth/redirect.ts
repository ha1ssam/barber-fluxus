/** Aceita só caminhos internos para evitar redirecionamento aberto. */
export function safeNext(next: unknown, fallback: string): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
