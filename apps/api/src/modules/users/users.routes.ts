import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@kairos-crm/database';
import { createUserSchema, updateUserSchema, AppError } from '@kairos-crm/shared';
import { authenticate } from '../../middleware/auth';
import { injectTenantContext } from '../../middleware/tenant';
import { requireRole, requirePermission } from '../../middleware/permissions';
import * as userService from './users.service';
import { sendError } from '../../lib/errors';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', injectTenantContext);

  // ===== Me =====
  app.get('/me', async (req, reply) => {
    try {
      const user = (req as any).user;
      return reply.send(user);
    } catch (err) { return sendError(reply, err); }
  });

  app.post('/me/password', async (req, reply) => {
    try {
      const user = (req as any).user;
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

      const u = await prisma.user.findUnique({ where: { id: user.id } });
      if (!u) throw AppError.notFound('Usuário');
      const ok = await bcrypt.compare(currentPassword, u.passwordHash);
      if (!ok) throw AppError.badRequest('Senha atual incorreta');

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      await prisma.auditLog.create({
        data: { tenantId: user.tenantId, userId: user.id, action: 'user.password_changed' },
      });
      return reply.send({ ok: true });
    } catch (err) { return sendError(reply, err); }
  });

  // Listar usuários do tenant
  app.get(
    '/',
    { preHandler: [requireRole('TENANT_ADMIN', 'MANAGER', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        const q = req.query as any;
        const users = await userService.listUsers(user, {
          search: q.search,
          role: q.role,
        });
        return reply.send({ data: users });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Buscar usuário
  app.get<{ Params: { id: string } }>(
    '/:id',
    async (req, reply) => {
      try {
        const user = (req as any).user;
        const u = await userService.getUser(user, req.params.id);
        return reply.send(u);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Criar usuário
  app.post(
    '/',
    { preHandler: [requireRole('TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        const input = createUserSchema.parse(req.body);
        const newUser = await userService.createUser(user, input);
        return reply.status(201).send(newUser);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Atualizar usuário
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        const input = updateUserSchema.parse(req.body);
        const updated = await userService.updateUser(user, req.params.id, input);
        return reply.send(updated);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Deletar usuário (soft)
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        await userService.deleteUser(user, req.params.id);
        return reply.status(204).send();
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );
}
