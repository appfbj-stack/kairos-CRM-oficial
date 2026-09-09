import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import { verifyAccessToken } from '../lib/jwt';
import { prisma } from '@kairos-crm/database';

/**
 * Decora o request com `request.user` após validar o JWT.
 * Não verifica tenant — quem faz isso é o middleware de tenant.
 */
export async function authenticate(req: FastifyRequest, _reply: FastifyReply) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw AppError.unauthenticated('Token não fornecido');
    }
    const token = auth.slice(7);
    const payload = await verifyAccessToken(token);

    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      include: { tenant: { select: { id: true, slug: true, status: true } } },
    });

    if (!user) {
      throw AppError.unauthenticated('Usuário não encontrado');
    }

    if (user.status !== 'ACTIVE') {
      throw AppError.forbidden('Usuário inativo');
    }

    if (user.tenant && user.tenant.status === 'BLOCKED') {
      throw AppError.forbidden('Tenant bloqueado');
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      throw AppError.forbidden('Tenant suspenso');
    }

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug ?? null,
    };

    (req as any).user = authUser;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthenticated('Token inválido ou expirado');
  }
}
