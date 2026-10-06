import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/auth';
import { injectTenantContext } from '../../../middleware/tenant';
import { requireRole } from '../../../middleware/permissions';
import { createCompanySchema, listCompaniesQuerySchema, updateCompanySchema } from './companies.schema';
import * as service from './companies.service';
import { sendError } from '../../../lib/errors';

export async function companyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', injectTenantContext);

  app.get('/', async (req, reply) => {
    try {
      const user = (req as any).user;
      const q = listCompaniesQuerySchema.parse(req.query);
      return reply.send(await service.listCompanies(user, q));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    try {
      const user = (req as any).user;
      return reply.send(await service.getCompany(user, req.params.id));
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/', { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] }, async (req, reply) => {
    try {
      const user = (req as any).user;
      const input = createCompanySchema.parse(req.body);
      return reply.status(201).send(await service.createCompany(user, input));
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
        const input = updateCompanySchema.parse(req.body);
        return reply.send(await service.updateCompany(user, req.params.id, input));
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
        await service.deleteCompany(user, req.params.id);
        return reply.status(204).send();
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );
}