export declare const USER_ROLES: readonly ["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER", "AGENT", "USER"];
export type UserRole = (typeof USER_ROLES)[number];
/**
 * Hierarquia de permissões.
 * Cada role herda as permissões dos roles abaixo.
 */
export declare const ROLE_LEVEL: Record<UserRole, number>;
export declare function roleAtLeast(actual: UserRole, required: UserRole): boolean;
/**
 * Permissões granulares (Fase 2+).
 * Mapeadas em middleware.
 */
export declare const PERMISSIONS: {
    readonly 'crm.contact.read': readonly ["AGENT", "MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
    readonly 'crm.contact.write': readonly ["AGENT", "MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
    readonly 'crm.contact.delete': readonly ["MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
    readonly 'crm.lead.read': readonly ["AGENT", "MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
    readonly 'crm.lead.write': readonly ["AGENT", "MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
    readonly 'crm.pipeline.write': readonly ["MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
    readonly 'tenant.users.read': readonly ["MANAGER", "TENANT_ADMIN", "SUPER_ADMIN"];
    readonly 'tenant.users.write': readonly ["TENANT_ADMIN", "SUPER_ADMIN"];
    readonly 'tenant.settings.write': readonly ["TENANT_ADMIN", "SUPER_ADMIN"];
    readonly 'admin.tenants.read': readonly ["SUPER_ADMIN"];
    readonly 'admin.tenants.write': readonly ["SUPER_ADMIN"];
};
export type Permission = keyof typeof PERMISSIONS;
