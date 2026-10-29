import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { ThemeToggle } from '@/components/theme-toggle';

export async function PublicHeader() {
  const user = await getCurrentUser();
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link href="/" aria-label="Fluxus">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/fluxus-full-dark.svg" alt="Fluxus" className="logo-light" />
        </Link>
        <nav className="row">
          <Link className="btn btn-ghost btn-sm" href="/explorar">Explorar</Link>
          {user ? (
            <>
              <Link className="btn btn-ghost btn-sm" href="/meus-agendamentos">Meus agendamentos</Link>
              <form action="/sair" method="post">
                <button className="btn btn-ghost btn-sm" type="submit">Sair</button>
              </form>
            </>
          ) : (
            <Link className="btn btn-primary btn-sm" href="/entrar">Entrar</Link>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
