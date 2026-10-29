import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fluxus',
    short_name: 'Fluxus',
    description: 'Agenda, WhatsApp e caixa da sua barbearia.',
    start_url: '/painel',
    scope: '/',
    display: 'standalone',
    background_color: '#0c0c0e',
    theme_color: '#1d1d1f',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
