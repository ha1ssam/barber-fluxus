import type { Metadata, Viewport } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import '@/styles/tokens.css';
import '@/styles/fluxus.css';
import '@/styles/app.css';
import { ToastProvider } from '@/components/toast';
import { ServiceWorker } from '@/components/pwa';

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' });
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-space-grotesk', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Fluxus — agendamento para barbearias', template: '%s · Fluxus' },
  description: 'Agenda online, WhatsApp, lembretes, caixa e fidelidade para barbearias e negócios de beleza.',
  applicationName: 'Fluxus',
  icons: { icon: '/logos/fluxus-icon.svg', apple: '/icons/icon-192.png' },
  appleWebApp: { capable: true, title: 'Fluxus', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0c0e' },
  ],
};

// Aplica o tema salvo antes da pintura para não piscar.
const themeScript = `try{var t=localStorage.getItem('fx-theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${grotesk.variable}`} suppressHydrationWarning>
      <body>
        <Script id="fx-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
