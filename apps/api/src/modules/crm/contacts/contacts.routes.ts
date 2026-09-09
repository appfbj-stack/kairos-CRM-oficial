import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/auth';
import { injectTenantContext } from '../../../middleware/tenant';
import { requireRole } from '../../../middleware/permissions';
import { createContactSchema, listContactsQuerySchema, updateContactSchema } from './contacts.schema';
import * as service from './contacts.service';
import { sendError } from '../../../lib/errors';

export async function contactRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', injectTenantContext);

  app.get('/', async (req, reply) => {
    try {
      const user = (req as any).user;
      const q = listContactsQuerySchema.parse(req.query);
      const result = await service.listContacts(user, q);
      return reply.send(result);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const user = (req as any).user;
      return reply.send(await service.getContact(user, req.params.id));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/', { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] }, async (req, reply) => {
    try {
      const user = (req as any).user;
      const input = createContactSchema.parse(req.body);
      return reply.status(201).send(await service.createContact(user, input));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        const input = updateContactSchema.parse(req.body);
        return reply.send(await service.updateContact(user, req.params.id, input));
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        await service.deleteContact(user, req.params.id);
        return reply.status(204).send();
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );
}
