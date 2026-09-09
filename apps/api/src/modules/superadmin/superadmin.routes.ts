/**
 * Super Admin - Painel Operacional LGPD-compliant
 *
 * IMPORTANTE: Este módulo NÃO retorna dados pessoais de tenants
 * (leads, contatos, conversas, mensagens, knowledge). Apenas:
 *  - Métricas agregadas (counts)
 *  - Status técnico
 *  - Ações administrativas (com log obrigatório)
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import { sendError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env';

async function logAction(opts: {
  superAdminId: string;
  tenantId?: string;
  action: string;
  target?: string;
  metadata?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await prisma.superAdminAction.create({
    data: {
      superAdminId: opts.superAdminId,
      tenantId: opts.tenantId,
      action: opts.action,
      target: opts.target,
      metadata: opts.metadata || {},
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    },
  });
}

function getRequestMeta(req: FastifyRequest) {
  return {
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function superAdminRoutes(app: FastifyInstance) {
  // Sub-app com auth + role check
  await app.register(async (subApp) => {
    subApp.addHook('preHandler', async (req: any, reply: any) => {
      const { authenticate } = await import('../../middleware/auth');
      await authenticate(req, reply);
    });
    subApp.addHook('preHandler', async (req: any, reply: any) => {
      if (req.user?.role !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Apenas super admin' } });
      }
    });

    // === OVERVIEW ===

    subApp.get('/api/superadmin/tenants/overview', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);

        const tenants = await prisma.tenant.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                users: true,
                leads: true,
                contacts: true,
                whatsappAccounts: true,
                conversations: true,
                automations: true,
              },
            },
          },
        });

        const openTickets = await prisma.accessTicket.findMany({
          where: { status: 'OPEN' },
        });
        const ticketByTenant = new Map(openTickets.map((t) => [t.tenantId, t]));

        await logAction({
          superAdminId: user.id,
          action: 'TENANT_OVERVIEW_VIEW',
          metadata: { count: tenants.length },
          ...meta,
        });

        return reply.send({
          tenants: tenants.map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            email: t.email,
            plan: t.plan,
            status: t.status,
            primaryColor: t.primaryColor,
            logoUrl: t.logoUrl,
            createdAt: t.createdAt,
            trialEndsAt: t.trialEndsAt,
            metrics: {
              users: t._count.users,
              leads: t._count.leads,
              contacts: t._count.contacts,
              whatsappAccounts: t._count.whatsappAccounts,
              conversations: t._count.conversations,
              automations: t._count.automations,
            },
            activeAccessTicket: ticketByTenant.has(t.id)
              ? {
                  id: ticketByTenant.get(t.id)!.id,
                  scope: ticketByTenant.get(t.id)!.scope,
                  reason: ticketByTenant.get(t.id)!.reason,
                  authorizedBy: ticketByTenant.get(t.id)!.authorizedBy,
                  expiresAt: ticketByTenant.get(t.id)!.expiresAt,
                }
              : null,
          })),
          complianceNote: 'Apenas métricas agregadas. Para acessar dados pessoais, abra um AccessTicket.',
        });
      } catch (err) { return sendError(reply, err); }
    });

    subApp.get<{ Params: { id: string } }>('/api/superadmin/tenants/:id/overview', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const { id } = req.params;

        const t = await prisma.tenant.findFirst({
          where: { id, deletedAt: null },
          include: {
            _count: {
              select: {
                users: true, leads: true, contacts: true,
                companies: true, tasks: true, products: true, services: true,
                whatsappAccounts: true, conversations: true,
                automations: true, followups: true, appointments: true,
                knowledgeEntries: true,
              },
            },
          },
        });
        if (!t) throw AppError.notFound('Tenant');

        await logAction({
          superAdminId: user.id, tenantId: id,
          action: 'TENANT_DETAIL_VIEW', ...meta,
        });

        return reply.send({
          id: t.id, name: t.name, slug: t.slug, email: t.email,
          plan: t.plan, status: t.status, primaryColor: t.primaryColor,
          logoUrl: t.logoUrl, createdAt: t.createdAt, trialEndsAt: t.trialEndsAt,
          metrics: {
            users: t._count.users,
            leads: t._count.leads,
            contacts: t._count.contacts,
            companies: t._count.companies,
            tasks: t._count.tasks,
            products: t._count.products,
            services: t._count.services,
            whatsappAccounts: t._count.whatsappAccounts,
            conversations: t._count.conversations,
            automations: t._count.automations,
            followups: t._count.followups,
            appointments: t._count.appointments,
            knowledgeEntries: t._count.knowledgeEntries,
          },
          complianceNote: 'Apenas contadores. Para acessar dados pessoais, abra um AccessTicket.',
        });
      } catch (err) { return sendError(reply, err); }
    });

    // Lista usuários do tenant (id, nome, email, role) — para o modal de reset senha
    subApp.get<{ Params: { id: string } }>('/api/superadmin/tenants/:id/users', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const { id } = req.params;

        const users = await prisma.user.findMany({
          where: { tenantId: id, deletedAt: null },
          select: { id: true, name: true, email: true, role: true, status: true },
          orderBy: { name: 'asc' },
        });
        await logAction({
          superAdminId: user.id, tenantId: id,
          action: 'TENANT_USERS_VIEW', metadata: { count: users.length }, ...meta,
        });
        return reply.send({ users });
      } catch (err) { return sendError(reply, err); }
    });

    // === BILLING ===

    subApp.get('/api/superadmin/billing', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const tenants = await prisma.tenant.findMany({
          where: { deletedAt: null },
          orderBy: { paymentDueDate: { sort: 'asc', nulls: 'last' } },
          select: {
            id: true, name: true, slug: true, email: true, plan: true, status: true,
            paymentDueDate: true, lastPaymentAt: true, monthlyAmount: true,
          },
        });

        const now = new Date();
        const enriched = tenants.map((t) => {
          const due = t.paymentDueDate;
          const overdueDays = due ? Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000)) : 0;
          const isOverdue = due ? due < now : false;
          return {
            ...t,
            monthlyAmount: t.monthlyAmount ? Number(t.monthlyAmount) : null,
            overdueDays,
            isOverdue,
            blocked: t.status === 'BLOCKED',
          };
        });

        const summary = {
          totalTenants: enriched.length,
          active: enriched.filter((t) => t.status === 'ACTIVE' || t.status === 'TRIAL').length,
          overdue: enriched.filter((t) => t.isOverdue && t.status !== 'BLOCKED').length,
          blocked: enriched.filter((t) => t.status === 'BLOCKED').length,
          monthlyRevenue: enriched
            .filter((t) => t.status === 'ACTIVE')
            .reduce((acc, t) => acc + (t.monthlyAmount || 0), 0),
          overdueAmount: enriched
            .filter((t) => t.isOverdue && t.status !== 'BLOCKED')
            .reduce((acc, t) => acc + (t.monthlyAmount || 0), 0),
        };

        await logAction({
          superAdminId: user.id, action: 'BILLING_VIEW',
          metadata: { tenants: enriched.length, overdue: summary.overdue }, ...meta,
        });

        return reply.send({ tenants: enriched, summary });
      } catch (err) { return sendError(reply, err); }
    });

    subApp.post<{ Params: { id: string } }>('/api/superadmin/tenants/:id/block-payment', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const { id } = req.params;

        const before = await prisma.tenant.findUnique({ where: { id } });
        if (!before) throw AppError.notFound('Tenant');

        const t = await prisma.tenant.update({
          where: { id },
          data: { status: 'BLOCKED' },
        });
        await logAction({
          superAdminId: user.id, tenantId: id,
          action: 'TENANT_BLOCK_PAYMENT', target: id,
          metadata: { reason: 'inadimplência', overdueDays: (req.body as any)?.overdueDays || 0 },
          ...meta,
        });
        logger.warn({ tenantId: id, superAdmin: user.email }, 'TENANT BLOCKED — INADIMPLÊNCIA');
        return reply.send({ ok: true, status: t.status });
      } catch (err) { return sendError(reply, err); }
    });

    const unblockSchema = z.object({
      nextDueDate: z.string().optional(),
      monthlyAmount: z.number().optional(),
    });

    subApp.post<{ Params: { id: string } }>('/api/superadmin/tenants/:id/unblock-payment', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const { id } = req.params;
        const body = unblockSchema.parse(req.body || {});

        const t = await prisma.tenant.update({
          where: { id },
          data: {
            status: 'ACTIVE',
            lastPaymentAt: new Date(),
            ...(body.nextDueDate ? { paymentDueDate: new Date(body.nextDueDate) } : {}),
            ...(body.monthlyAmount !== undefined ? { monthlyAmount: body.monthlyAmount } : {}),
          },
        });
        await logAction({
          superAdminId: user.id, tenantId: id,
          action: 'TENANT_UNBLOCK_PAYMENT', target: id,
          metadata: { nextDueDate: body.nextDueDate, monthlyAmount: body.monthlyAmount },
          ...meta,
        });
        return reply.send({
          ok: true,
          status: t.status,
          paymentDueDate: t.paymentDueDate,
          lastPaymentAt: t.lastPaymentAt,
        });
      } catch (err) { return sendError(reply, err); }
    });

    // === AÇÕES ADMINISTRATIVAS (todas com log) ===

    subApp.post<{ Params: { id: string } }>('/api/superadmin/tenants/:id/disable', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const { id } = req.params;
        const t = await prisma.tenant.update({
          where: { id },
          data: { status: 'SUSPENDED' },
        });
        await logAction({
          superAdminId: user.id, tenantId: id,
          action: 'TENANT_DISABLE', target: id, ...meta,
        });
        logger.warn({ tenantId: id, superAdmin: user.email }, 'TENANT DISABLED');
        return reply.send({ ok: true, status: t.status });
      } catch (err) { return sendError(reply, err); }
    });

    subApp.post<{ Params: { id: string } }>('/api/superadmin/tenants/:id/enable', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const { id } = req.params;
        const t = await prisma.tenant.update({
          where: { id },
          data: { status: 'ACTIVE' },
        });
        await logAction({
          superAdminId: user.id, tenantId: id,
          action: 'TENANT_ENABLE', target: id, ...meta,
        });
        return reply.send({ ok: true, status: t.status });
      } catch (err) { return sendError(reply, err); }
    });

    const changePlanSchema = z.object({
      plan: z.enum(['FREE', 'BASIC', 'PRO', 'PREMIUM']),
    });

    subApp.post<{ Params: { id: string } }>('/api/superadmin/tenants/:id/change-plan', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const { id } = req.params;
        const { plan } = changePlanSchema.parse(req.body);

        const before = await prisma.tenant.findUnique({ where: { id } });
        if (!before) throw AppError.notFound('Tenant');

        const t = await prisma.tenant.update({ where: { id }, data: { plan } });
        await logAction({
          superAdminId: user.id, tenantId: id,
          action: 'TENANT_CHANGE_PLAN', target: id,
          metadata: { oldPlan: before.plan, newPlan: plan }, ...meta,
        });
        return reply.send({ ok: true, plan: t.plan });
      } catch (err) { return sendError(reply, err); }
    });

    const resetPasswordSchema = z.object({
      newPassword: z.string().min(8),
    });

    subApp.post<{ Params: { id: string } }>('/api/superadmin/users/:id/reset-password', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const { id } = req.params;
        const { newPassword } = resetPasswordSchema.parse(req.body);

        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) throw AppError.notFound('Usuário');

        const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
        await prisma.user.update({ where: { id }, data: { passwordHash } });
        await prisma.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await logAction({
          superAdminId: user.id, tenantId: target.tenantId || undefined,
          action: 'PASSWORD_RESET', target: id, ...meta,
        });
        logger.warn({ userId: id, superAdmin: user.email }, 'PASSWORD RESET BY SUPER ADMIN');
        return reply.send({ ok: true });
      } catch (err) { return sendError(reply, err); }
    });

    // === ACCESS TICKETS (LGPD Art. 37/38) ===

    subApp.get('/api/superadmin/access-tickets', async (req, reply) => {
      try {
        const tickets = await prisma.accessTicket.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            tenant: { select: { id: true, name: true, slug: true } },
          },
        });
        return reply.send({ tickets });
      } catch (err) { return sendError(reply, err); }
    });

    const openTicketSchema = z.object({
      tenantId: z.string().uuid(),
      reason: z.string().min(20, 'Motivo deve ter no mínimo 20 caracteres (LGPD Art. 37)'),
      authorizedBy: z.string().email('Autorizador deve ser email válido'),
      scope: z.enum(['leads', 'conversations', 'contacts', 'messages', 'all']),
      expiresInHours: z.number().int().min(1).max(168).default(24),
    });

    subApp.post('/api/superadmin/access-tickets', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const body = openTicketSchema.parse(req.body);

        const expiresAt = new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000);

        const ticket = await prisma.accessTicket.create({
          data: {
            tenantId: body.tenantId,
            openedBy: user.id,
            authorizedBy: body.authorizedBy,
            reason: body.reason,
            scope: body.scope,
            expiresAt,
            ipAddress: meta.ipAddress,
          },
        });

        await logAction({
          superAdminId: user.id, tenantId: body.tenantId,
          action: 'ACCESS_TICKET_OPEN', target: ticket.id,
          metadata: { scope: body.scope, reason: body.reason, expiresAt }, ...meta,
        });
        logger.warn({
          ticketId: ticket.id, tenantId: body.tenantId,
          scope: body.scope, superAdmin: user.email,
        }, 'ACCESS TICKET OPENED');

        return reply.status(201).send(ticket);
      } catch (err) { return sendError(reply, err); }
    });

    subApp.post<{ Params: { id: string } }>('/api/superadmin/access-tickets/:id/close', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const { id } = req.params;

        const t = await prisma.accessTicket.update({
          where: { id },
          data: { status: 'REVOKED', closedAt: new Date() },
        });
        await logAction({
          superAdminId: user.id, tenantId: t.tenantId,
          action: 'ACCESS_TICKET_CLOSE', target: id, ...meta,
        });
        return reply.send({ ok: true });
      } catch (err) { return sendError(reply, err); }
    });

    // Endpoint seguro: retorna apenas contadores com base num ticket ativo
    subApp.get<{ Params: { id: string } }>('/api/superadmin/access-tickets/:id/scope', async (req, reply) => {
      try {
        const user = (req as any).user as AuthenticatedUser;
        const meta = getRequestMeta(req);
        const { id } = req.params;

        const ticket = await prisma.accessTicket.findUnique({ where: { id } });
        if (!ticket) throw AppError.notFound('Ticket');
        if (ticket.openedBy !== user.id) throw AppError.forbidden('Ticket não é seu');
        if (ticket.status !== 'OPEN') throw AppError.badRequest('Ticket não está aberto');
        if (ticket.expiresAt < new Date()) throw AppError.badRequest('Ticket expirado');

        const { tenantId, scope } = ticket;
        const counters: any = {};
        if (scope === 'leads' || scope === 'all') {
          counters.leads = await prisma.lead.count({ where: { tenantId, deletedAt: null } });
        }
        if (scope === 'conversations' || scope === 'all') {
          counters.conversations = await prisma.conversation.count({ where: { tenantId } });
        }
        if (scope === 'contacts' || scope === 'all') {
          counters.contacts = await prisma.contact.count({ where: { tenantId } });
        }
        if (scope === 'messages' || scope === 'all') {
          counters.messages = await prisma.message.count({ where: { tenantId } });
        }

        await prisma.accessTicket.update({
          where: { id },
          data: { accessedData: { viewedAt: new Date(), counters } },
        });
        await logAction({
          superAdminId: user.id, tenantId,
          action: 'ACCESS_TICKET_SCOPE_VIEW', target: id,
          metadata: { scope, counters }, ...meta,
        });

        return reply.send({
          ticket: {
            id: ticket.id,
            reason: ticket.reason,
            authorizedBy: ticket.authorizedBy,
            scope: ticket.scope,
            expiresAt: ticket.expiresAt,
          },
          counters,
          complianceNote: 'Apenas contadores são retornados, não conteúdo. Logado para auditoria.',
        });
      } catch (err) { return sendError(reply, err); }
    });

    // === AUDIT LOG DO SUPER ADMIN ===

    subApp.get('/api/superadmin/audit', async (req, reply) => {
      try {
        const actions = await prisma.superAdminAction.findMany({
          orderBy: { createdAt: 'desc' },
          take: 200,
          include: {
            superAdmin: { select: { id: true, name: true, email: true } },
          },
        });
        return reply.send({ actions, retentionNote: 'Retido por 5 anos (LGPD Art. 16).' });
      } catch (err) { return sendError(reply, err); }
    });
  });
}
