import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import type { CreateLeadInput, UpdateLeadInput, MoveLeadInput } from './leads.schema';
import { emit } from '../../webhooks/dispatcher';

export async function listLeads(actor: AuthenticatedUser, query: {
  pipelineId?: string;
  stageId?: string;
  status?: string;
  temperature?: string;
  assignedUserId?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  if (!actor.tenantId) throw AppError.forbidden();

  const where: any = { tenantId: actor.tenantId, deletedAt: null };
  if (query.pipelineId) where.pipelineId = query.pipelineId;
  if (query.stageId) where.stageId = query.stageId;
  if (query.status) where.status = query.status;
  if (query.temperature) where.temperature = query.temperature;
  if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { interest: { contains: query.search, mode: 'insensitive' } },
      { contact: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ temperature: 'desc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        stage: { select: { id: true, name: true, color: true, position: true, isWon: true, isLost: true } },
        assignedUser: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    data: items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getLead(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      contact: true,
      stage: true,
      pipeline: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      tasks: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      followups: { orderBy: { scheduledAt: 'desc' }, take: 20 },
    },
  });
  if (!lead) throw AppError.notFound('Lead');
  if (lead.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return lead;
}

export async function createLead(actor: AuthenticatedUser, input: CreateLeadInput) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não cria lead direto');

  // Verifica contact e stage pertencem ao tenant
  const [contact, stage, pipeline] = await Promise.all([
    prisma.contact.findFirst({ where: { id: input.contactId, deletedAt: null } }),
    prisma.pipelineStage.findFirst({ where: { id: input.stageId }, include: { pipeline: true } }),
    prisma.pipeline.findFirst({ where: { id: input.pipelineId } }),
  ]);
  if (!contact) throw AppError.notFound('Contato');
  if (contact.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  if (!stage) throw AppError.notFound('Etapa');
  if (stage.pipelineId !== input.pipelineId) throw AppError.validation('Etapa não pertence ao pipeline');
  if (!pipeline || pipeline.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  const tenantId = actor.tenantId;
  return prisma.lead.create({
    data: {
      tenantId,
      contactId: input.contactId,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      title: input.title,
      valueCents: input.valueCents,
      assignedUserId: input.assignedUserId,
      interest: input.interest,
      origin: input.origin,
      intention: input.intention,
    },
  }).then((lead) => {
    // F3.5: fire-and-forget webhook
    emit('lead.created', tenantId, {
      id: lead.id,
      title: lead.title,
      valueCents: lead.valueCents,
      status: lead.status,
      temperature: lead.temperature,
      pipelineId: lead.pipelineId,
      stageId: lead.stageId,
      contactId: lead.contactId,
      interest: lead.interest,
      origin: lead.origin,
      createdAt: lead.createdAt,
    }).catch(() => {});
    return lead;
  });
}

export async function updateLead(actor: AuthenticatedUser, id: string, input: UpdateLeadInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw AppError.notFound('Lead');
  if (lead.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  const data: any = { ...input };

  // Se status mudou pra WON/LOST, marca timestamp
  if (input.status === 'WON' && lead.status !== 'WON') data.wonAt = new Date();
  if (input.status === 'LOST' && lead.status !== 'LOST') data.lostAt = new Date();

  return prisma.lead.update({ where: { id }, data });
}

export async function moveLead(actor: AuthenticatedUser, id: string, input: MoveLeadInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  const tenantId = actor.tenantId;
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw AppError.notFound('Lead');
  if (lead.tenantId !== tenantId) throw AppError.tenantMismatch();

  // Verifica que a stage pertence ao mesmo pipeline
  const stage = await prisma.pipelineStage.findFirst({ where: { id: input.stageId } });
  if (!stage) throw AppError.notFound('Etapa');
  if (stage.pipelineId !== lead.pipelineId) throw AppError.validation('Etapa não pertence ao pipeline');

  // Se moveu pra WON/LOST, atualiza status
  const data: any = { stageId: input.stageId };
  let statusAfter: 'OPEN' | 'WON' | 'LOST' = 'OPEN';
  if (stage.isWon) {
    data.status = 'WON';
    data.wonAt = new Date();
    statusAfter = 'WON';
  } else if (stage.isLost) {
    data.status = 'LOST';
    data.lostAt = new Date();
    statusAfter = 'LOST';
  } else {
    data.status = 'OPEN';
    data.wonAt = null;
    data.lostAt = null;
  }

  return prisma.lead.update({ where: { id }, data }).then((updated) => {
    // F3.5: dispara eventos granulares
    emit('lead.stage_changed', tenantId, {
      id: updated.id,
      title: updated.title,
      pipelineId: updated.pipelineId,
      stageId: updated.stageId,
      stageName: stage.name,
      status: updated.status,
      previousStatus: lead.status,
    }).catch(() => {});

    if (statusAfter === 'WON') {
      emit('lead.won', tenantId, {
        id: updated.id, title: updated.title,
        pipelineId: updated.pipelineId, stageId: updated.stageId,
        valueCents: updated.valueCents, wonAt: updated.wonAt,
      }).catch(() => {});
    } else if (statusAfter === 'LOST') {
      emit('lead.lost', tenantId, {
        id: updated.id, title: updated.title,
        pipelineId: updated.pipelineId, stageId: updated.stageId,
        lostAt: updated.lostAt,
      }).catch(() => {});
    }
    return updated;
  });
}

export async function deleteLead(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
  if (!lead) throw AppError.notFound('Lead');
  if (lead.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
}
