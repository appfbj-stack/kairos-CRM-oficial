"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSIONS = exports.ROLE_LEVEL = exports.USER_ROLES = void 0;
exports.roleAtLeast = roleAtLeast;
exports.USER_ROLES = [
    'SUPER_ADMIN',
    'TENANT_ADMIN',
    'MANAGER',
    'AGENT',
    'USER',
];
/**
 * Hierarquia de permissões.
 * Cada role herda as permissões dos roles abaixo.
 */
exports.ROLE_LEVEL = {
    SUPER_ADMIN: 100,
    TENANT_ADMIN: 50,
    MANAGER: 30,
    AGENT: 20,
    USER: 10,
};
function roleAtLeast(actual, required) {
    return exports.ROLE_LEVEL[actual] >= exports.ROLE_LEVEL[required];
}
/**
 * Permissões granulares (Fase 2+).
 * Mapeadas em middleware.
 */
exports.PERMISSIONS = {
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
};
