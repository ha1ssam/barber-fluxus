export type Role = 'OWNER' | 'BARBER' | 'RECEPTIONIST';

export type Permission =
  | 'agenda.all' // operar a agenda de qualquer profissional
  | 'agenda.own'
  | 'clients'
  | 'services.manage'
  | 'cash'
  | 'products'
  | 'loyalty'
  | 'whatsapp'
  | 'reports'
  | 'team'
  | 'settings'
  | 'billing';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    'agenda.all',
    'agenda.own',
    'clients',
    'services.manage',
    'cash',
    'products',
    'loyalty',
    'whatsapp',
    'reports',
    'team',
    'settings',
    'billing',
  ],
  RECEPTIONIST: ['agenda.all', 'agenda.own', 'clients', 'cash', 'loyalty', 'whatsapp'],
  BARBER: ['agenda.own', 'clients'],
};

export interface MemberLike {
  role: Role;
  canManageOwnServices?: boolean;
}

export function can(member: MemberLike, permission: Permission): boolean {
  if (permission === 'services.manage' && member.role === 'BARBER' && member.canManageOwnServices) return true;
  return ROLE_PERMISSIONS[member.role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Dono',
  BARBER: 'Profissional',
  RECEPTIONIST: 'Recepcionista',
};
