export const USER_ROLES = [
  'SUPER_ADMIN',
  'TENANT_ADMIN',
  'MANAGER',
  'AGENT',
  'USER',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Hierarquia de permissões.
 * Cada role herda as permissões dos roles abaixo.
 */
export const ROLE_LEVEL: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  TENANT_ADMIN: 50,
  MANAGER: 30,
  AGENT: 20,
  USER: 10,
};

export function roleAtLeast(actual: UserRole, required: UserRole): boolean {
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[required];
}

/**
 * Permissões granulares (Fase 2+).
 * Mapeadas em middleware.
 */
export const PERMISSIONS = {
  // CRM
  'crm.contact.read': ['AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'],
  'crm.contact.write': ['AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'],
  'crm.contact.delete': ['MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'],
  'crm.lead.read': ['AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'],
  'crm.lead.write': ['AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'],
  'crm.pipeline.write': ['MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'],

  // Tenant
  'tenant.users.read': ['MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'],
  'tenant.users.write': ['TENANT_ADMIN', 'SUPER_ADMIN'],
  'tenant.settings.write': ['TENANT_ADMIN', 'SUPER_ADMIN'],

  // Admin global
  'admin.tenants.read': ['SUPER_ADMIN'],
  'admin.tenants.write': ['SUPER_ADMIN'],
} as const;

export type Permission = keyof typeof PERMISSIONS;
