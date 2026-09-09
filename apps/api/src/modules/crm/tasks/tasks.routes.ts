import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/auth';
import { injectTenantContext } from '../../../middleware/tenant';
import { requireRole } from '../../../middleware/permissions';
import { createTaskSchema, listTasksQuerySchema, updateTaskSchema } from './tasks.schema';
import * as service from './tasks.service';
import { sendError } from '../../../lib/errors';

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', injectTenantContext);

  app.get('/', async (req, reply) => {
    try {
      const user = (req as any).user;
      const q = listTasksQuerySchema.parse(req.query);
      return reply.send(await service.listTasks(user, q));
    } catch (err) { return sendError(reply, err); }
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const user = (req as any).user;
      return reply.send(await service.getTask(user, req.params.id));
    } catch (err) { return sendError(reply, err); }
  });

  app.post('/', { preHandler: [requireRole('USER', 'AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] }, async (req, reply) => {
    try {
      const user = (req as any).user;
      const input = createTaskSchema.parse(req.body);
      return reply.status(201).send(await service.createTask(user, input));
    } catch (err) { return sendError(reply, err); }
  });

  app.patch<{ Params: { id: string } }>('/:id',
    { preHandler: [requireRole('USER', 'AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        const input = updateTaskSchema.parse(req.body);
        return reply.send(await service.updateTask(user, req.params.id, input));
      } catch (err) { return sendError(reply, err); }
    });

  app.delete<{ Params: { id: string } }>('/:id',
    { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        await service.deleteTask(user, req.params.id);
        return reply.status(204).send();
      } catch (err) { return sendError(reply, err); }
    });
}
