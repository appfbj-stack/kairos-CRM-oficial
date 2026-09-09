/**
 * Rotas REST para notificações in-app do usuário logado.
 *
 * GET    /api/notifications              Lista (paginado) - 50 mais recentes
 * GET    /api/notifications/unread-count Badge (sino)
 * POST   /api/notifications/:id/read     Marcar 1 como lida
 * POST   /api/notifications/read-all     Marcar todas como lidas
 * DELETE /api/notifications/:id          Excluir notificação
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import { sendError } from '../../lib/errors';

export async function notificationRoutes(app: FastifyInstance) {
  await app.register(async (subApp) => {
    subApp.addHook('preHandler', async (req: any, reply: any) => {
      const { authenticate } = await import('../../middleware/auth');
      await authenticate(req, reply);
    });

    subApp.get('/api/notifications', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const list = await prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        const unreadCount = list.filter((n) => !n.read).length;
        return reply.send({ notifications: list, unreadCount });
      } catch (err) { return sendError(reply, err); }
    });

    subApp.get('/api/notifications/unread-count', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const count = await prisma.notification.count({
          where: { userId: user.id, read: false },
        });
        return reply.send({ count });
      } catch (err) { return sendError(reply, err); }
    });

    subApp.post<{ Params: { id: string } }>('/api/notifications/:id/read', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const n = await prisma.notification.findFirst({
          where: { id: req.params.id, userId: user.id },
        });
        if (!n) throw AppError.notFound('Notificação');
        if (!n.read) {
          await prisma.notification.update({
            where: { id: n.id },
            data: { read: true, readAt: new Date() },
          });
        }
        return reply.send({ ok: true });
      } catch (err) { return sendError(reply, err); }
    });

    subApp.post('/api/notifications/read-all', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        await prisma.notification.updateMany({
          where: { userId: user.id, read: false },
          data: { read: true, readAt: new Date() },
        });
        return reply.send({ ok: true });
      } catch (err) { return sendError(reply, err); }
    });

    subApp.delete<{ Params: { id: string } }>('/api/notifications/:id', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        await prisma.notification.deleteMany({
          where: { id: req.params.id, userId: user.id },
        });
        return reply.status(204).send();
      } catch (err) { return sendError(reply, err); }
    });
  });
}
