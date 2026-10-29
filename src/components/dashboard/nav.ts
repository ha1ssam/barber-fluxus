import type { IconName } from '@/components/ui/Icon';
import type { Permission } from '@/lib/domain/permissions';
import type { Feature } from '@/lib/domain/plans';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  category: string;
  permission?: Permission;
  feature?: Feature;
}

export const NAV: NavItem[] = [
  { href: '/painel', label: 'Dashboard', icon: 'bar-chart-alt-2', category: 'Geral' },
  { href: '/painel/agenda', label: 'Agenda', icon: 'calendar', category: 'Geral', permission: 'agenda.own' },
  { href: '/painel/agendamentos', label: 'Agendamentos', icon: 'calendar-check', category: 'Geral', permission: 'agenda.own' },
  { href: '/painel/clientes', label: 'Clientes', icon: 'group', category: 'Geral', permission: 'clients' },
  { href: '/painel/servicos', label: 'Serviços', icon: 'cut', category: 'Negócio' },
  { href: '/painel/bloqueios', label: 'Bloqueios', icon: 'calendar-x', category: 'Negócio', permission: 'agenda.own' },
  { href: '/painel/fila', label: 'Fila de espera', icon: 'list-ul', category: 'Negócio', permission: 'agenda.own' },
  { href: '/painel/avaliacoes', label: 'Avaliações', icon: 'star', category: 'Negócio', permission: 'settings' },
  { href: '/painel/caixa', label: 'Caixa', icon: 'wallet', category: 'Gestão', permission: 'cash', feature: 'cash' },
  { href: '/painel/produtos', label: 'Produtos', icon: 'package', category: 'Gestão', permission: 'products', feature: 'cash' },
  { href: '/painel/comissoes', label: 'Comissões', icon: 'receipt', category: 'Gestão', permission: 'reports', feature: 'commission' },
  { href: '/painel/fidelidade', label: 'Fidelidade', icon: 'purchase-tag', category: 'Gestão', permission: 'loyalty', feature: 'loyalty' },
  { href: '/painel/whatsapp', label: 'WhatsApp', icon: 'whatsapp', category: 'Gestão', permission: 'whatsapp' },
  { href: '/painel/relatorios', label: 'Relatórios', icon: 'line-chart', category: 'Gestão', permission: 'reports', feature: 'reports' },
  { href: '/painel/equipe', label: 'Equipe', icon: 'user-plus', category: 'Gestão', permission: 'team' },
  { href: '/painel/configuracoes', label: 'Configurações', icon: 'cog', category: 'Conta' },
  { href: '/painel/assinatura', label: 'Assinatura', icon: 'credit-card', category: 'Conta', permission: 'billing' },
];

export const MOBILE_NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/painel', label: 'Início', icon: 'bar-chart-alt-2' },
  { href: '/painel/agenda', label: 'Agenda', icon: 'calendar' },
  { href: '/painel/agendamentos', label: 'Reservas', icon: 'calendar-check' },
  { href: '/painel/clientes', label: 'Clientes', icon: 'group' },
];
