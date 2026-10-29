'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cx, initials } from '@/components/ui';
import type { NavItem } from './nav';
import { MOBILE_NAV } from './nav';

const DrawerCtx = createContext<() => void>(() => undefined);
export const useOpenDrawer = () => useContext(DrawerCtx);

export interface ShellProps {
  items: Pick<NavItem, 'href' | 'label' | 'icon' | 'category'>[];
  user: { name: string; shop: string; plan: string; planTier: 'free' | 'pro' | 'team' | 'admin' };
  pendingCount: number;
  banner?: { text: string; href: string; cta: string; expired: boolean } | null;
  shops: { id: string; name: string }[];
  activeShopId: string;
  switchShop: (formData: FormData) => Promise<void>;
  children: ReactNode;
}

export function Shell({ items, user, pendingCount, banner, shops, activeShopId, switchShop, children }: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('fx-sidebar') === 'collapsed');
    } catch {}
  }, []);
  const isActive = (href: string) => (href === '/painel' ? pathname === '/painel' : pathname.startsWith(href));
  let lastCat = '';
  const isCollapsed = collapsed && !drawer;

  return (
    <DrawerCtx.Provider value={() => setDrawer(true)}>
      <div className={cx('app-shell', drawer && 'drawer-open')}>
        <div className="app-sidebar">
          <aside className={cx('fx-sidebar', isCollapsed && 'collapsed')}>
            <div className="fx-sidebar-brand">
              <Link href="/painel" aria-label="Início">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="fx-sidebar-logo" src={isCollapsed ? '/logos/fluxus-icon-white.svg' : '/logos/fluxus-full.svg'} alt="Fluxus" style={{ filter: 'none' }} />
              </Link>
              {isCollapsed ? null : (
                <button
                  type="button"
                  className="fx-nav-item"
                  style={{ width: 28, height: 28, minHeight: 28, padding: 0, justifyContent: 'center', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}
                  aria-label={drawer ? 'Fechar menu' : 'Recolher menu'}
                  onClick={() => {
                    if (drawer) return setDrawer(false);
                    setCollapsed(true);
                    try {
                      localStorage.setItem('fx-sidebar', 'collapsed');
                    } catch {}
                  }}
                >
                  <Icon name={drawer ? 'x' : 'chevrons-left'} size={14} />
                </button>
              )}
            </div>
            <div className="fx-sidebar-user">
              <div className="fx-avatar">{initials(user.name)}</div>
              {isCollapsed ? null : (
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="fx-sidebar-user-name">{user.name}</div>
                  <div className="fx-sidebar-user-meta">
                    <Icon name="store-alt" size={10} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.shop}</span>
                    <span className={cx('fx-plan-chip', user.planTier)}>{user.plan}</span>
                  </div>
                </div>
              )}
            </div>
            {shops.length > 1 && !isCollapsed ? (
              <form action={switchShop} style={{ margin: '0 12px 8px' }}>
                <select
                  name="shopId"
                  defaultValue={activeShopId}
                  aria-label="Trocar de loja"
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', color: 'var(--sidebar-text-strong)', border: '1px solid var(--sidebar-border)', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </form>
            ) : null}
            {isCollapsed ? null : <div className="fx-sidebar-hr" />}
            <nav className="fx-sidebar-nav" aria-label="Menu do painel">
              {items.map((it) => {
                const showCat = !isCollapsed && it.category !== lastCat;
                lastCat = it.category;
                const active = isActive(it.href);
                return (
                  <div key={it.href} style={{ display: 'contents' }}>
                    {showCat ? <div className="fx-nav-category">{it.category}</div> : null}
                    <Link href={it.href} className={cx('fx-nav-item', active && 'active')} aria-current={active ? 'page' : undefined} title={isCollapsed ? it.label : undefined}>
                      <Icon name={it.icon} size={18} />
                      {isCollapsed ? null : <span>{it.label}</span>}
                      {it.href === '/painel/agendamentos' && pendingCount > 0 ? <span className="nav-count" aria-label={`${pendingCount} pendentes`}>{pendingCount}</span> : null}
                    </Link>
                  </div>
                );
              })}
            </nav>
            <div className="fx-sidebar-foot">
              {collapsed && !drawer ? (
                <button
                  type="button"
                  className="fx-nav-item"
                  aria-label="Expandir menu"
                  onClick={() => {
                    setCollapsed(false);
                    try {
                      localStorage.setItem('fx-sidebar', 'open');
                    } catch {}
                  }}
                >
                  <Icon name="chevrons-right" size={18} />
                </button>
              ) : null}
              <Link href="/painel/configuracoes?aba=conta" className="fx-nav-item">
                <Icon name="user-circle" size={18} />
                {isCollapsed ? null : <span>Meu perfil</span>}
              </Link>
              <form action="/sair" method="post">
                <button type="submit" className="fx-nav-item">
                  <Icon name="log-out" size={18} />
                  {isCollapsed ? null : <span>Sair</span>}
                </button>
              </form>
            </div>
          </aside>
        </div>
        <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
        <div className="app-main">
          {banner ? (
            <div className={cx('trial-banner', banner.expired && 'expired')}>
              <span>{banner.text}</span>
              <Link href={banner.href} className="btn btn-sm btn-primary">
                {banner.cta}
              </Link>
            </div>
          ) : null}
          {children}
        </div>
        <nav className="mobile-nav" aria-label="Navegação rápida">
          {MOBILE_NAV.map((it) => (
            <Link key={it.href} href={it.href} className={cx(isActive(it.href) && 'active')}>
              <Icon name={it.icon} size={20} />
              {it.label}
            </Link>
          ))}
          <a
            href="#menu"
            onClick={(e) => {
              e.preventDefault();
              setDrawer(true);
            }}
          >
            <Icon name="menu" size={20} />
            Menu
          </a>
        </nav>
      </div>
    </DrawerCtx.Provider>
  );
}

export function MenuButton() {
  const open = useOpenDrawer();
  return (
    <button type="button" className="btn-icon topbar-menu" aria-label="Abrir menu" onClick={open}>
      <Icon name="menu" size={18} />
    </button>
  );
}
