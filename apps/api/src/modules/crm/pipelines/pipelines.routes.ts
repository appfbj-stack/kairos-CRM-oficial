import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../../middleware/auth';
import { injectTenantContext } from '../../../middleware/tenant';
import { requireRole } from '../../../middleware/permissions';
import * as service from './pipelines.service';
import { sendError } from '../../../lib/errors';

const createPipelineSchema = z.object({
  name: z.string().min(2).max(60),
  isDefault: z.boolean().optional(),
  stages: z.array(z.object({
    name: z.string().min(1).max(40),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    isWon: z.boolean().optional(),
    isLost: z.boolean().optional(),
  })).min(2).max(10),
});

const updatePipelineSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  isDefault: z.boolean().optional(),
});

export async function pipelineRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', injectTenantContext);

  app.get('/', async (req, reply) => {
    try {
      const user = (req as any).user;
      return reply.send(await service.listPipelines(user));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const user = (req as any).user;
      return reply.send(await service.getPipeline(user, req.params.id));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post(
    '/',
    { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        const input = createPipelineSchema.parse(req.body);
        return reply.status(201).send(await service.createPipeline(user, input));
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        const input = updatePipelineSchema.parse(req.body);
        return reply.send(await service.updatePipeline(user, req.params.id, input));
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
        await service.deletePipeline(user, req.params.id);
        return reply.status(204).send();
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );
}
