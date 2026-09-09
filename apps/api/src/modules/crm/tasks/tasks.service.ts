import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import type { CreateTaskInput, UpdateTaskInput } from './tasks.schema';

async function assertTenantOwnership(
  model: 'lead' | 'contact' | 'conversation',
  id: string,
  tenantId: string,
) {
  const record = await (prisma as any)[model].findFirst({ where: { id } });
  if (!record) throw AppError.notFound(model === 'lead' ? 'Lead' : model === 'contact' ? 'Contato' : 'Conversa');
  if (record.tenantId !== tenantId) throw AppError.tenantMismatch();
  return record;
}

export async function listTasks(actor: AuthenticatedUser, query: {
  status?: string; priority?: string; assignedUserId?: string; leadId?: string; contactId?: string; search?: string; page: number; limit: number;
}) {
  if (!actor.tenantId) throw AppError.forbidden();
  const where: any = { tenantId: actor.tenantId, deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
  if (query.leadId) where.leadId = query.leadId;
  if (query.contactId) where.contactId = query.contactId;
  if (query.search) where.OR = [
    { title: { contains: query.search, mode: 'insensitive' } },
    { description: { contains: query.search, mode: 'insensitive' } },
  ];

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.limit, take: query.limit,
      include: {
        assignedUser: { select: { id: true, name: true, avatarUrl: true } },
        lead: { select: { id: true, title: true } },
        contact: { select: { id: true, name: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return { data: items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function getTask(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const t = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: {
      assignedUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      lead: { select: { id: true, title: true, status: true } },
      contact: true,
    },
  });
  if (!t) throw AppError.notFound('Tarefa');
  if (t.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return t;
}

export async function createTask(actor: AuthenticatedUser, input: CreateTaskInput) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não cria tarefa direto');
  if (input.leadId) await assertTenantOwnership('lead', input.leadId, actor.tenantId);
  if (input.contactId) await assertTenantOwnership('contact', input.contactId, actor.tenantId);
  if (input.conversationId) await assertTenantOwnership('conversation', input.conversationId, actor.tenantId);

  return prisma.task.create({
    data: {
      tenantId: actor.tenantId,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      status: input.status,
      priority: input.priority,
      assignedUserId: input.assignedUserId,
      leadId: input.leadId,
      contactId: input.contactId,
      conversationId: input.conversationId,
    },
  });
}

export async function updateTask(actor: AuthenticatedUser, id: string, input: UpdateTaskInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  const t = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!t) throw AppError.notFound('Tarefa');
  if (t.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  const data: any = { ...input };
  if (input.status === 'DONE' && t.status !== 'DONE') data.completedAt = new Date();
  if (input.status && input.status !== 'DONE' && t.status === 'DONE') data.completedAt = null;

  return prisma.task.update({ where: { id }, data });
}

export async function deleteTask(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const t = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!t) throw AppError.notFound('Tarefa');
  if (t.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
}
