import type { FastifyRequest } from 'fastify';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import { setTenantContext } from '@kairos-crm/database';

/**
 * Após authenticate(), injeta o tenantId no contexto do Prisma.
 * SUPER_ADMIN (tenantId null) não tem contexto de tenant.
 */
export async function injectTenantContext(req: FastifyRequest) {
  const user = (req as any).user as AuthenticatedUser | undefined;
  if (!user) {
    throw AppError.unauthenticated();
  }

  // SUPER_ADMIN não tem tenantId
  if (user.role !== 'SUPER_ADMIN' && !user.tenantId) {
    throw AppError.forbidden('Usuário sem tenant vinculado');
  }

  setTenantContext(user.tenantId);
}

/**
 * Helper para garantir que um registro pertence ao tenant do usuário.
 * Use em services antes de update/delete.
 */
export function assertSameTenant(
  user: AuthenticatedUser,
  recordTenantId: string | null | undefined,
) {
  if (user.role === 'SUPER_ADMIN') return;
  if (!user.tenantId || recordTenantId !== user.tenantId) {
    throw AppError.tenantMismatch();
  }
}
