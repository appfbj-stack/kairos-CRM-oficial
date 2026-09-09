import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { injectTenantContext } from '../../middleware/tenant';
import { requireRole } from '../../middleware/permissions';
import { sendError } from '../../lib/errors';
import {
  createAutomationSchema, updateAutomationSchema, listAutomationsQuerySchema,
  createFollowUpSchema, listFollowUpsQuerySchema,
  createAppointmentSchema, updateAppointmentSchema, listAppointmentsQuerySchema,
} from './automations.schema';
import * as service from './automations.service';

export async function automationsRoutes(app: FastifyInstance) {
  await app.register(async (sub) => {
    sub.addHook('preHandler', authenticate);
    sub.addHook('preHandler', injectTenantContext);

    // ===== Automations =====
    sub.get('/api/automations', async (req, reply) => {
      try {
        const user = (req as any).user;
        const q = listAutomationsQuerySchema.parse(req.query);
        return reply.send(await service.listAutomations(user, q));
      } catch (err) { return sendError(reply, err); }
    });

    sub.get<{ Params: { id: string } }>('/api/automations/:id', async (req, reply) => {
      try {
        const user = (req as any).user;
        return reply.send(await service.getAutomation(user, req.params.id));
      } catch (err) { return sendError(reply, err); }
    });

    sub.post('/api/automations',
      { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          const input = createAutomationSchema.parse(req.body);
          return reply.status(201).send(await service.createAutomation(user, input));
        } catch (err) { return sendError(reply, err); }
      });

    sub.patch<{ Params: { id: string } }>('/api/automations/:id',
      { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          const input = updateAutomationSchema.parse(req.body);
          return reply.send(await service.updateAutomation(user, req.params.id, input));
        } catch (err) { return sendError(reply, err); }
      });

    sub.delete<{ Params: { id: string } }>('/api/automations/:id',
      { preHandler: [requireRole('TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          await service.deleteAutomation(user, req.params.id);
          return reply.status(204).send();
        } catch (err) { return sendError(reply, err); }
      });

    sub.post('/api/automations/install-templates',
      { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          return reply.send(await service.installTemplates(user));
        } catch (err) { return sendError(reply, err); }
      });

    // ===== FollowUps =====
    sub.get('/api/followups', async (req, reply) => {
      try {
        const user = (req as any).user;
        const q = listFollowUpsQuerySchema.parse(req.query);
        return reply.send(await service.listFollowUps(user, q));
      } catch (err) { return sendError(reply, err); }
    });

    sub.post('/api/followups',
      { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          const input = createFollowUpSchema.parse(req.body);
          return reply.status(201).send(await service.createFollowUp(user, input));
        } catch (err) { return sendError(reply, err); }
      });

    sub.post<{ Params: { id: string } }>('/api/followups/:id/cancel',
      { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          return reply.send(await service.cancelFollowUp(user, req.params.id));
        } catch (err) { return sendError(reply, err); }
      });

    // ===== Appointments =====
    sub.get('/api/appointments', async (req, reply) => {
      try {
        const user = (req as any).user;
        const q = listAppointmentsQuerySchema.parse(req.query);
        return reply.send(await service.listAppointments(user, q));
      } catch (err) { return sendError(reply, err); }
    });

    sub.post('/api/appointments',
      { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          const input = createAppointmentSchema.parse(req.body);
          return reply.status(201).send(await service.createAppointment(user, input));
        } catch (err) { return sendError(reply, err); }
      });

    sub.patch<{ Params: { id: string } }>('/api/appointments/:id',
      { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          const input = updateAppointmentSchema.parse(req.body);
          return reply.send(await service.updateAppointment(user, req.params.id, input));
        } catch (err) { return sendError(reply, err); }
      });

    sub.post<{ Params: { id: string } }>('/api/appointments/:id/cancel',
      async (req, reply) => {
        try {
          const user = (req as any).user;
          const { reason } = (req.body || {}) as { reason?: string };
          return reply.send(await service.cancelAppointment(user, req.params.id, reason));
        } catch (err) { return sendError(reply, err); }
      });
  });
}
