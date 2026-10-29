// Rotas do app que não podem virar endereço de loja.
export const RESERVED_SLUGS = new Set([
  'api', 'painel', 'entrar', 'cadastro', 'sair', 'explorar', 'meus-agendamentos', 'conta', 'convite', 'a',
  'recuperar-senha', 'redefinir-senha', 'verificar-email', 'planos', 'admin', 'static', '_next', 'favicon.ico',
  'manifest.webmanifest', 'sw.js', 'robots.txt', 'sitemap.xml', 'termos', 'privacidade', 'ajuda', 'icons', 'logos',
]);

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/.test(slug) && !slug.includes('--') && !RESERVED_SLUGS.has(slug);
}
