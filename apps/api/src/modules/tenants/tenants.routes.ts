import type { FastifyInstance } from 'fastify';
import {
  createTenantSchema,
  updateTenantSchema,
  tenantActionSchema,
} from '@kairos-crm/shared';
import { authenticate } from '../../middleware/auth';
import { requireSuperAdmin, requireRole } from '../../middleware/permissions';
import { injectTenantContext } from '../../middleware/tenant';
import * as tenantService from './tenants.service';
import { sendError } from '../../lib/errors';

export async function tenantRoutes(app: FastifyInstance) {
  // Todas as rotas aqui exigem autenticação
  app.addHook('preHandler', authenticate);

  // Listar tenants (Super Admin)
  app.get(
    '/',
    { preHandler: [requireSuperAdmin] },
    async (req, reply) => {
      try {
        const q = req.query as any;
        const result = await tenantService.listTenants({
          page: q.page ? Number(q.page) : undefined,
          limit: q.limit ? Number(q.limit) : undefined,
          status: q.status,
          search: q.search,
        });
        return reply.send(result);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Buscar tenant por ID
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireSuperAdmin] },
    async (req, reply) => {
      try {
        const tenant = await tenantService.getTenant(req.params.id);
        return reply.send(tenant);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Buscar tenant por slug (público, para tela de login)
  app.get<{ Params: { slug: string } }>(
    '/by-slug/:slug',
    async (req, reply) => {
      try {
        const tenant = await tenantService.getTenantBySlug(req.params.slug);
        return reply.send({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
        });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Criar tenant (Super Admin)
  app.post(
    '/',
    { preHandler: [requireSuperAdmin] },
    async (req, reply) => {
      try {
        const input = createTenantSchema.parse(req.body);
        const user = (req as any).user;
        const tenant = await tenantService.createTenant(input, user.id, req.ip);
        return reply.status(201).send(tenant);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Atualizar tenant (Super Admin)
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireSuperAdmin] },
    async (req, reply) => {
      try {
        const input = updateTenantSchema.parse(req.body);
        const user = (req as any).user;
        const tenant = await tenantService.updateTenant(req.params.id, input, user.id);
        return reply.send(tenant);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // Ações (ativar/suspender/bloquear/desbloquear)
  app.post<{ Params: { id: string } }>(
    '/:id/action',
    { preHandler: [requireSuperAdmin] },
    async (req, reply) => {
      try {
        const input = tenantActionSchema.parse(req.body);
        const user = (req as any).user;
        const tenant = await tenantService.tenantAction(req.params.id, input, user.id);
        return reply.send(tenant);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );
}
