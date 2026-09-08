import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { injectTenantContext } from '../../middleware/tenant';
import { requireRole } from '../../middleware/permissions';
import { sendError } from '../../lib/errors';
import {
  createKnowledgeSchema,
  listKnowledgeQuerySchema,
  searchKnowledgeSchema,
  updateKnowledgeSchema,
} from './knowledge.schema';
import * as service from './knowledge.service';

export async function knowledgeRoutes(app: FastifyInstance) {
  await app.register(async (sub) => {
    sub.addHook('preHandler', authenticate);
    sub.addHook('preHandler', injectTenantContext);

    sub.get('/api/knowledge', async (req, reply) => {
      try {
        const user = (req as any).user;
        const q = listKnowledgeQuerySchema.parse(req.query);
        return reply.send(await service.list(user, q));
      } catch (err) { return sendError(reply, err); }
    });

    sub.get<{ Params: { id: string } }>('/api/knowledge/:id', async (req, reply) => {
      try {
        const user = (req as any).user;
        return reply.send(await service.get(user, req.params.id));
      } catch (err) { return sendError(reply, err); }
    });

    sub.post('/api/knowledge',
      { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          const input = createKnowledgeSchema.parse(req.body);
          return reply.status(201).send(await service.create(user, input));
        } catch (err) { return sendError(reply, err); }
      });

    sub.patch<{ Params: { id: string } }>('/api/knowledge/:id',
      { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          const input = updateKnowledgeSchema.parse(req.body);
          return reply.send(await service.update(user, req.params.id, input));
        } catch (err) { return sendError(reply, err); }
      });

    sub.delete<{ Params: { id: string } }>('/api/knowledge/:id',
      { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          await service.remove(user, req.params.id);
          return reply.status(204).send();
        } catch (err) { return sendError(reply, err); }
      });

    sub.post('/api/knowledge/search', async (req, reply) => {
      try {
        const user = (req as any).user;
        const { query, limit } = searchKnowledgeSchema.parse(req.body);
        return reply.send({ data: await service.search(user, query, limit) });
      } catch (err) { return sendError(reply, err); }
    });
  });
}
