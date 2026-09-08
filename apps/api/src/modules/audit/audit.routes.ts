import type { FastifyInstance } from 'fastify';
import { prisma } from '@kairos-crm/database';
import { AppError } from '@kairos-crm/shared';
import { authenticate } from '../../middleware/auth';
import { injectTenantContext } from '../../middleware/tenant';
import { requireRole } from '../../middleware/permissions';
import { sendError } from '../../lib/errors';

export async function auditRoutes(app: FastifyInstance) {
  await app.register(async (sub) => {
    sub.addHook('preHandler', authenticate);
    sub.addHook('preHandler', injectTenantContext);

    sub.get('/api/audit', async (req, reply) => {
      try {
        const user = (req as any).user;
        if (!user.tenantId) throw AppError.forbidden();
        if (!['TENANT_ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(user.role)) throw AppError.forbidden();

        const q = req.query as { action?: string; limit?: string; userId?: string };
        const where: any = { tenantId: user.tenantId };
        if (q.action) where.action = q.action;
        if (q.userId) where.userId = q.userId;

        const logs = await prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Math.min(parseInt(q.limit || '100'), 200),
          include: { user: { select: { id: true, name: true, email: true } } },
        });
        return reply.send({ data: logs });
      } catch (err) { return sendError(reply, err); }
    });
  });
}
