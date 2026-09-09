import type { FastifyInstance } from 'fastify';
import { prisma } from '@kairos-crm/database';
import { authenticate } from '../../middleware/auth';
import { sendError } from '../../lib/errors';

const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * GET /api/dashboard/stats
 *
 * - SUPER_ADMIN: estatísticas globais (todos os tenants)
 * - tenant user: estatísticas do próprio tenant
 */
export async function dashboardRoutes(app: FastifyInstance) {
  await app.register(async (sub) => {
    sub.addHook('preHandler', authenticate);

    sub.get('/api/dashboard/stats', async (req, reply) => {
      try {
        const user = (req as any).user;

        // ===== SUPER ADMIN =====
        if (user.role === 'SUPER_ADMIN' && !user.tenantId) {
          const [tenants, activeTenants, users, leads, wonLeads, conversations, messagesToday, recentTenants] =
            await Promise.all([
              prisma.tenant.count({ where: { deletedAt: null } }),
              prisma.tenant.count({ where: { status: 'ACTIVE', deletedAt: null } }),
              prisma.user.count({ where: { deletedAt: null } }),
              prisma.lead.count({ where: { deletedAt: null } }),
              prisma.lead.count({ where: { status: 'WON', deletedAt: null } }),
              prisma.conversation.count(),
              prisma.message.count({ where: { createdAt: { gte: startOfToday() } } }),
              prisma.tenant.findMany({
                where: { deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, name: true, slug: true, status: true, plan: true, createdAt: true },
              }),
            ]);

          return reply.send({
            scope: 'super',
            totals: {
              tenants,
              activeTenants,
              users,
              leads,
              wonLeads,
              conversionRate: leads > 0 ? Math.round((wonLeads / leads) * 100) : 0,
              conversations,
              messagesToday,
            },
            recentTenants,
          });
        }

        // ===== TENANT USER =====
        if (!user.tenantId) {
          return reply.status(403).send({
            error: { code: 'FORBIDDEN', message: 'Usuário sem tenant associado' },
          });
        }

        const tid = user.tenantId;
        const [
          contacts,
          leads,
          openLeads,
          wonLeads,
          lostLeads,
          conversations,
          openConversations,
          messagesToday,
          openTasks,
          overdueTasks,
          whatsappAccounts,
          recentLeads,
          upcomingAppointments,
        ] = await Promise.all([
          prisma.contact.count({ where: { tenantId: tid, deletedAt: null } }),
          prisma.lead.count({ where: { tenantId: tid, deletedAt: null } }),
          prisma.lead.count({ where: { tenantId: tid, status: 'OPEN', deletedAt: null } }),
          prisma.lead.count({ where: { tenantId: tid, status: 'WON', deletedAt: null } }),
          prisma.lead.count({ where: { tenantId: tid, status: 'LOST', deletedAt: null } }),
          prisma.conversation.count({ where: { tenantId: tid } }),
          prisma.conversation.count({ where: { tenantId: tid, status: { in: ['OPEN', 'WITH_AI', 'WITH_HUMAN'] } } }),
          prisma.message.count({ where: { tenantId: tid, createdAt: { gte: startOfToday() } } }),
          prisma.task.count({ where: { tenantId: tid, status: { in: ['TODO', 'DOING'] }, deletedAt: null } }),
          prisma.task.count({
            where: {
              tenantId: tid,
              status: { in: ['TODO', 'DOING'] },
              dueDate: { lt: new Date() },
              deletedAt: null,
            },
          }),
          prisma.whatsAppAccount.count({ where: { tenantId: tid, deletedAt: null } }),
          prisma.lead.findMany({
            where: { tenantId: tid, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              title: true,
              status: true,
              temperature: true,
              valueCents: true,
              createdAt: true,
              contact: { select: { name: true } },
            },
          }),
          prisma.appointment.findMany({
            where: {
              tenantId: tid,
              status: 'SCHEDULED',
              startTime: { gte: new Date() },
            },
            orderBy: { startTime: 'asc' },
            take: 5,
            include: { contact: { select: { name: true } } },
          }),
        ]);

        return reply.send({
          scope: 'tenant',
          totals: {
            contacts,
            leads,
            openLeads,
            wonLeads,
            lostLeads,
            conversionRate: leads > 0 ? Math.round((wonLeads / leads) * 100) : 0,
            conversations,
            openConversations,
            messagesToday,
            openTasks,
            overdueTasks,
            whatsappAccounts,
          },
          recentLeads,
          upcomingAppointments,
        });
      } catch (err) {
        return sendError(reply, err);
      }
    });
  });
}
