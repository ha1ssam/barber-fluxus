import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PageBadge } from '@/components/ui/basic';
import { ThemeToggle } from '@/components/theme-toggle';
import { MenuButton } from './Shell';

export function Topbar({ title, icon, badge, actions }: { title: string; icon?: IconName; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="fx-topbar">
      <div className="fx-topbar-title">
        <MenuButton />
        {icon ? <Icon name={icon} size={18} /> : null}
        <h1 style={{ fontSize: 15, fontWeight: 700 }}>{title}</h1>
        {badge ? <PageBadge>{badge}</PageBadge> : null}
      </div>
      <div className="fx-topbar-actions">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}

export function Page({ title, icon, badge, actions, children }: { title: string; icon?: IconName; badge?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <Topbar title={title} icon={icon} badge={badge} actions={actions} />
      <div className="app-content stack-lg">{children}</div>
    </>
  );
}

export function FeatureLocked({ feature, reason }: { feature: string; reason?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name="lock-alt" size={20} />
      </div>
      <p className="empty-title">{feature} não está no seu plano</p>
      <p className="empty-text">{reason ?? 'Faça upgrade para o plano Equipe para liberar este recurso.'}</p>
      <a className="btn btn-primary" href="/painel/assinatura">
        Ver planos
      </a>
    </div>
  );
}
