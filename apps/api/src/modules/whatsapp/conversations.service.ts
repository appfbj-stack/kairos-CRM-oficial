import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import { evolution } from '../../lib/evolution';
import { logger } from '../../lib/logger';

export async function listConversations(actor: AuthenticatedUser, query: { status?: string; search?: string; page: number; limit: number }) {
  if (!actor.tenantId) throw AppError.forbidden();
  const where: any = { tenantId: actor.tenantId };
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { lastMessagePreview: { contains: query.search, mode: 'insensitive' } },
      { contact: { name: { contains: query.search, mode: 'insensitive' } } },
      { contact: { phone: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      skip: (query.page - 1) * query.limit, take: query.limit,
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        whatsappAccount: { select: { id: true, name: true, status: true, instanceId: true, apiKey: true } },
        assignedUser: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  return { data: items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function getConversation(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const c = await prisma.conversation.findFirst({
    where: { id },
    include: {
      contact: true,
      whatsappAccount: { select: { id: true, name: true, status: true, instanceId: true, phone: true, apiKey: true } },
      assignedUser: { select: { id: true, name: true, avatarUrl: true } },
      lead: { select: { id: true, title: true, stage: { select: { id: true, name: true, color: true } } } },
    },
  });
  if (!c) throw AppError.notFound('Conversa');
  if (c.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  // Zera unread
  if (c.unreadCount > 0) {
    await prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } });
  }
  return c;
}

export async function listMessages(actor: AuthenticatedUser, conversationId: string, query: { page: number; limit: number }) {
  if (!actor.tenantId) throw AppError.forbidden();
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId } });
  if (!conv) throw AppError.notFound('Conversa');
  if (conv.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  const [items, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip: (query.page - 1) * query.limit, take: query.limit,
      include: { senderUser: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);
  return { data: items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function sendMessage(actor: AuthenticatedUser, conversationId: string, content: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  if (!content || !content.trim()) throw AppError.validation('Mensagem vazia');

  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId },
    include: { contact: true, whatsappAccount: true },
  });
  if (!conv) throw AppError.notFound('Conversa');
  if (conv.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  if (!conv.whatsappAccount || conv.whatsappAccount.status !== 'CONNECTED') {
    throw AppError.badRequest('Conta WhatsApp não está conectada');
  }

  try {
    if (!conv.whatsappAccount.apiKey) {
      throw AppError.badRequest('Conta WhatsApp sem token de instância — recrie a conta');
    }
    const res = await evolution.sendText(conv.whatsappAccount.apiKey, conv.contact.phone!, content.trim());
    const msg = await prisma.message.create({
      data: {
        tenantId: actor.tenantId,
        conversationId: conv.id,
        senderType: 'USER',
        senderUserId: actor.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: content.trim(),
        externalId: res?.data?.key?.id,
      },
    });
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: new Date(), lastMessagePreview: content.trim().slice(0, 120) },
    });
    return msg;
  } catch (err) {
    logger.error({ err, conversationId }, 'falha ao enviar mensagem');
    throw AppError.badRequest(`Falha ao enviar: ${(err as Error).message}`);
  }
}

export async function takeoverConversation(actor: AuthenticatedUser, conversationId: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId } });
  if (!conv) throw AppError.notFound('Conversa');
  if (conv.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'WITH_HUMAN', assignedUserId: actor.id, aiPaused: true, aiPausedReason: 'agent_takeover' },
  });
}

export async function returnToAI(actor: AuthenticatedUser, conversationId: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId } });
  if (!conv) throw AppError.notFound('Conversa');
  if (conv.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'WITH_AI', assignedUserId: null, aiPaused: false, aiPausedReason: null },
  });
}

export async function closeConversation(actor: AuthenticatedUser, conversationId: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId } });
  if (!conv) throw AppError.notFound('Conversa');
  if (conv.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
}
