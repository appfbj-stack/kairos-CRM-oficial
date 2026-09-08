import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  AppError,
  type AuthenticatedUser,
  type Permission,
  PERMISSIONS,
} from '@kairos-crm/shared';

/**
 * Cria um guard que exige uma (ou mais) permissões.
 * Uso: preHandler: requirePermission('crm.lead.write')
 */
export function requirePermission(...required: Permission[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const user = (req as any).user as AuthenticatedUser | undefined;
    if (!user) throw AppError.unauthenticated();

    for (const perm of required) {
      const allowedRoles = PERMISSIONS[perm] as readonly string[];
      if (!allowedRoles.includes(user.role)) {
        throw AppError.forbidden(`Permissão necessária: ${perm}`);
      }
    }
  };
}

/**
 * Guard que exige role mínima (hierárquica).
 * Uso: preHandler: requireRole('TENANT_ADMIN')
 */
export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const user = (req as any).user as AuthenticatedUser | undefined;
    if (!user) throw AppError.unauthenticated();
    if (!roles.includes(user.role)) {
      throw AppError.forbidden(`Role necessária: ${roles.join(' ou ')}`);
    }
  };
}

/**
 * Guard para rotas exclusivas de Super Admin.
 */
export const requireSuperAdmin = requireRole('SUPER_ADMIN');
