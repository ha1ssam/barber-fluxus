import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthLayout({ children, title, text }: { children: ReactNode; title: string; text: string }) {
  return (
    <div className="mk auth-split">
      <aside className="auth-art">
        <Link href="/" aria-label="Fluxus">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/fluxus-full.svg" alt="Fluxus" style={{ height: 30 }} />
        </Link>
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="auth-art-mark" src="/logos/fluxus-icon-white.svg" alt="" />
        <span style={{ fontSize: 13, color: 'var(--mk-muted)' }}>© {new Date().getFullYear()} Fluxus</span>
      </aside>
      <main className="auth-form-side">
        <Link href="/" className="auth-mobile-brand" aria-label="Fluxus">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/fluxus-full.svg" alt="Fluxus" />
        </Link>
        {children}
      </main>
    </div>
  );
}
