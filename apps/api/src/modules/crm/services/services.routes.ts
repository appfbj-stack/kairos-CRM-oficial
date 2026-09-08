import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/auth';
import { injectTenantContext } from '../../../middleware/tenant';
import { requireRole } from '../../../middleware/permissions';
import { createServiceSchema, listServicesQuerySchema, updateServiceSchema } from './services.schema';
import * as service from './services.service';
import { sendError } from '../../../lib/errors';

export async function serviceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', injectTenantContext);

  app.get('/', async (req, reply) => {
    try {
      const user = (req as any).user;
      const q = listServicesQuerySchema.parse(req.query);
      return reply.send(await service.listServices(user, q));
    } catch (err) { return sendError(reply, err); }
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const user = (req as any).user;
      return reply.send(await service.getService(user, req.params.id));
    } catch (err) { return sendError(reply, err); }
  });

  app.post('/', { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] }, async (req, reply) => {
    try {
      const user = (req as any).user;
      const input = createServiceSchema.parse(req.body);
      return reply.status(201).send(await service.createService(user, input));
    } catch (err) { return sendError(reply, err); }
  });

  app.patch<{ Params: { id: string } }>('/:id',
    { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        const input = updateServiceSchema.parse(req.body);
        return reply.send(await service.updateService(user, req.params.id, input));
      } catch (err) { return sendError(reply, err); }
    });

  app.delete<{ Params: { id: string } }>('/:id',
    { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        await service.deleteService(user, req.params.id);
        return reply.status(204).send();
      } catch (err) { return sendError(reply, err); }
    });
}
