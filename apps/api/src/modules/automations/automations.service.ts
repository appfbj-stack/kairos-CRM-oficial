import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import { logger } from '../../lib/logger';
import { evolution } from '../../lib/evolution';
import type {
  CreateAutomationInput, UpdateAutomationInput,
  CreateFollowUpInput, CreateAppointmentInput, UpdateAppointmentInput,
} from './automations.schema';

// ===== Automations =====

export async function listAutomations(actor: AuthenticatedUser, query: { trigger?: string; active?: boolean; page: number; limit: number }) {
  if (!actor.tenantId) throw AppError.forbidden();
  const where: any = { tenantId: actor.tenantId };
  if (query.trigger) where.trigger = query.trigger;
  if (query.active !== undefined) where.active = query.active;
  const [items, total] = await Promise.all([
    prisma.automation.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.automation.count({ where }),
  ]);
  return { data: items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function getAutomation(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const a = await prisma.automation.findFirst({ where: { id } });
  if (!a) throw AppError.notFound('Automação');
  if (a.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return a;
}

export async function createAutomation(actor: AuthenticatedUser, input: CreateAutomationInput) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não cria direto');
  return prisma.automation.create({
    data: {
      tenantId: actor.tenantId,
      name: input.name,
      trigger: input.trigger,
      conditions: input.conditions ? (input.conditions as any) : undefined,
      actions: input.actions as any,
      isTemplate: input.isTemplate,
      active: input.active,
    },
  });
}

export async function updateAutomation(actor: AuthenticatedUser, id: string, input: UpdateAutomationInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  const a = await prisma.automation.findFirst({ where: { id } });
  if (!a) throw AppError.notFound('Automação');
  if (a.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return prisma.automation.update({ where: { id }, data: { ...input, conditions: input.conditions ? (input.conditions as any) : undefined } });
}

export async function deleteAutomation(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const a = await prisma.automation.findFirst({ where: { id } });
  if (!a) throw AppError.notFound('Automação');
  if (a.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  await prisma.automation.delete({ where: { id } });
}

/** Instala templates prontos pro tenant (idempotente). */
export async function installTemplates(actor: AuthenticatedUser) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não instala direto');
  const templates = [
    {
      name: 'Saudação novo lead',
      trigger: 'lead_created',
      actions: [{ type: 'send_whatsapp', params: { template: 'Olá {{contact.name}}! Vi que você se interessou por {{lead.title}}. Como posso ajudar?' } }],
    },
    {
      name: 'Follow-up 24h sem resposta',
      trigger: 'no_response_24h',
      actions: [{ type: 'send_whatsapp', params: { template: 'Oi {{contact.name}}, tudo bem? Vi que não conseguimos conversar ainda. Posso ajudar com algo?' } }],
    },
    {
      name: 'Criar tarefa ao receber mensagem',
      trigger: 'message_received',
      actions: [{ type: 'create_task', params: { title: 'Responder {{contact.name}}', priority: 'MEDIUM' } }],
    },
  ];
  const created = [];
  for (const t of templates) {
    const existing = await prisma.automation.findFirst({
      where: { tenantId: actor.tenantId, name: t.name, isTemplate: true },
    });
    if (!existing) {
      const c = await prisma.automation.create({
        data: {
          tenantId: actor.tenantId,
          name: t.name,
          trigger: t.trigger,
          actions: t.actions as any,
          isTemplate: true,
          active: false, // começa desativado — usuário liga
        },
      });
      created.push(c);
    }
  }
  return { installed: created.length, total: templates.length };
}

// ===== FollowUps =====

export async function listFollowUps(actor: AuthenticatedUser, query: { status?: string; assignedUserId?: string; page: number; limit: number }) {
  if (!actor.tenantId) throw AppError.forbidden();
  const where: any = { tenantId: actor.tenantId };
  if (query.status) where.status = query.status;
  if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
  const [items, total] = await Promise.all([
    prisma.followUp.findMany({
      where, orderBy: { scheduledAt: 'asc' },
      skip: (query.page - 1) * query.limit, take: query.limit,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        lead: { select: { id: true, title: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    }),
    prisma.followUp.count({ where }),
  ]);
  return { data: items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function createFollowUp(actor: AuthenticatedUser, input: CreateFollowUpInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  return prisma.followUp.create({
    data: {
      tenantId: actor.tenantId,
      contactId: input.contactId,
      leadId: input.leadId,
      conversationId: input.conversationId,
      messageTemplate: input.messageTemplate,
      scheduledAt: input.scheduledAt,
      assignedUserId: input.assignedUserId,
      status: 'SCHEDULED',
    },
  });
}

export async function cancelFollowUp(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const f = await prisma.followUp.findFirst({ where: { id } });
  if (!f) throw AppError.notFound('Follow-up');
  if (f.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  if (f.status !== 'SCHEDULED') throw AppError.badRequest('Follow-up não pode ser cancelado neste status');
  return prisma.followUp.update({ where: { id }, data: { status: 'CANCELLED' } });
}

/** Worker que processa follow-ups vencidos. Roda a cada 60s. */
export async function processScheduledFollowUps() {
  const now = new Date();
  const due = await prisma.followUp.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    take: 20,
    include: { contact: true },
  });
  for (const f of due) {
    try {
      if (!f.contact?.phone) {
        await prisma.followUp.update({ where: { id: f.id }, data: { status: 'FAILED', failedReason: 'no_phone' } });
        continue;
      }
      // Pega conta WhatsApp do tenant (primeira CONNECTED)
      const account = await prisma.whatsAppAccount.findFirst({
        where: { tenantId: f.tenantId, status: 'CONNECTED', deletedAt: null },
      });
      if (!account?.apiKey) {
        await prisma.followUp.update({ where: { id: f.id }, data: { status: 'FAILED', failedReason: 'no_whatsapp_account' } });
        continue;
      }
      await evolution.sendText(account.apiKey, f.contact.phone, f.messageTemplate);
      await prisma.followUp.update({
        where: { id: f.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: f.attempts + 1 },
      });
      logger.info({ followUpId: f.id, tenantId: f.tenantId }, 'follow-up enviado');
    } catch (err) {
      logger.warn({ err: (err as Error).message, followUpId: f.id }, 'follow-up falhou');
      await prisma.followUp.update({
        where: { id: f.id },
        data: {
          status: f.attempts + 1 >= 3 ? 'FAILED' : 'SCHEDULED',
          failedReason: (err as Error).message,
          attempts: f.attempts + 1,
          scheduledAt: f.attempts + 1 < 3 ? new Date(Date.now() + 5 * 60 * 1000) : f.scheduledAt, // retry em 5min
        },
      });
    }
  }
}

// ===== Appointments =====

export async function listAppointments(actor: AuthenticatedUser, query: { status?: string; contactId?: string; startDate?: Date; endDate?: Date; page: number; limit: number }) {
  if (!actor.tenantId) throw AppError.forbidden();
  const where: any = { tenantId: actor.tenantId };
  if (query.status) where.status = query.status;
  if (query.contactId) where.contactId = query.contactId;
  if (query.startDate || query.endDate) {
    where.startTime = {};
    if (query.startDate) where.startTime.gte = query.startDate;
    if (query.endDate) where.startTime.lte = query.endDate;
  }
  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where, orderBy: { startTime: 'asc' },
      skip: (query.page - 1) * query.limit, take: query.limit,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, durationMinutes: true, priceCents: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    }),
    prisma.appointment.count({ where }),
  ]);
  return { data: items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function createAppointment(actor: AuthenticatedUser, input: CreateAppointmentInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  if (input.endTime <= input.startTime) throw AppError.validation('endTime deve ser depois de startTime');
  if (input.serviceId) {
    const svc = await prisma.service.findFirst({ where: { id: input.serviceId } });
    if (!svc || svc.tenantId !== actor.tenantId) throw AppError.badRequest('Serviço inválido');
  }
  const contact = await prisma.contact.findFirst({ where: { id: input.contactId } });
  if (!contact || contact.tenantId !== actor.tenantId) throw AppError.badRequest('Contato inválido');
  return prisma.appointment.create({
    data: {
      tenantId: actor.tenantId,
      contactId: input.contactId,
      serviceId: input.serviceId,
      startTime: input.startTime,
      endTime: input.endTime,
      notes: input.notes,
      source: input.source,
      assignedUserId: input.assignedUserId,
    },
  });
}

export async function updateAppointment(actor: AuthenticatedUser, id: string, input: UpdateAppointmentInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  const a = await prisma.appointment.findFirst({ where: { id } });
  if (!a) throw AppError.notFound('Agendamento');
  if (a.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  const data: any = { ...input };
  if (input.status === 'CANCELLED' && a.status !== 'CANCELLED') {
    data.cancelledAt = new Date();
  }
  return prisma.appointment.update({ where: { id }, data });
}

export async function cancelAppointment(actor: AuthenticatedUser, id: string, reason?: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const a = await prisma.appointment.findFirst({ where: { id } });
  if (!a) throw AppError.notFound('Agendamento');
  if (a.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return prisma.appointment.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
  });
}
