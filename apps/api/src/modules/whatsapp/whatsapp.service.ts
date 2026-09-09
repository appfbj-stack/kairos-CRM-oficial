import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import { randomUUID } from 'crypto';
import { evolution } from '../../lib/evolution';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';

function normalizePhone(jidOrPhone: string): string {
  return (jidOrPhone || '').split('@')[0].replace(/\D/g, '');
}

// ===== Accounts (autenticadas) =====

export async function listAccounts(actor: AuthenticatedUser) {
  if (!actor.tenantId) throw AppError.forbidden();
  return prisma.whatsAppAccount.findMany({
    where: { tenantId: actor.tenantId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { conversations: true } } },
  });
}

export async function getAccount(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const a = await prisma.whatsAppAccount.findFirst({ where: { id, deletedAt: null } });
  if (!a) throw AppError.notFound('Conta WhatsApp');
  if (a.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return a;
}

export async function createAccount(actor: AuthenticatedUser, input: { name: string; number?: string }) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não cria conta direto');

  const instanceId = randomUUID();
  const webhookUrl = env.EVOLUTION_WEBHOOK_URL
    || `${env.WEB_ORIGIN.replace(/\/$/, '')}/api/whatsapp/webhook`;

  let perInstanceToken: string | null = null;
  let evolutionError: string | null = null;
  try {
    const r = await evolution.createInstance({ instanceName: instanceId, number: input.number, webhookUrl });
    perInstanceToken = r.token;
  } catch (err) {
    evolutionError = (err as Error).message;
    logger.warn({ err: evolutionError, instanceId }, 'Evolution create falhou — conta criada só no DB');
  }

  return prisma.whatsAppAccount.create({
    data: {
      tenantId: actor.tenantId,
      name: input.name,
      provider: 'EVOLUTION',
      instanceId,
      apiKey: perInstanceToken, // per-instance token
      phone: input.number,
      status: 'DISCONNECTED',
      config: evolutionError ? { providerNote: evolutionError } : undefined,
    },
  });
}

export async function connectAccount(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const acc = await prisma.whatsAppAccount.findFirst({ where: { id, deletedAt: null } });
  if (!acc) throw AppError.notFound('Conta WhatsApp');
  if (acc.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  if (!acc.apiKey) throw AppError.badRequest('Conta sem token — recrie a conta');

  try {
    return await evolution.connect(acc.apiKey);
  } catch (err) {
    return { qrCode: null, pairingCode: null, error: (err as Error).message };
  }
}

export async function refreshStatus(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const acc = await prisma.whatsAppAccount.findFirst({ where: { id, deletedAt: null } });
  if (!acc) throw AppError.notFound('Conta WhatsApp');
  if (acc.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  if (!acc.apiKey) return prisma.whatsAppAccount.update({ where: { id }, data: { lastSyncAt: new Date() } });

  let status: 'DISCONNECTED' | 'CONNECTED' | 'CONNECTING' = 'DISCONNECTED';
  let phone: string | null = acc.phone;
  try {
    const s = await evolution.getStatus(acc.apiKey);
    if (s) {
      // Connected = websocket aberto, LoggedIn = usuario logou no WhatsApp via QR
      // So marcar CONNECTED quando ambos forem true (senao fica falso positivo)
      if (s.LoggedIn && s.Connected) {
        status = 'CONNECTED';
      } else if (s.Connected) {
        status = 'CONNECTING'; // websocket aberto mas ainda sem scan
      } else {
        status = 'DISCONNECTED';
      }
      if (s.jid) phone = normalizePhone(s.jid);
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message, instanceId: acc.instanceId }, 'refreshStatus falhou');
  }
  return prisma.whatsAppAccount.update({
    where: { id },
    data: { status, phone, lastSyncAt: new Date() },
  });
}

export async function logoutAccount(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const acc = await prisma.whatsAppAccount.findFirst({ where: { id, deletedAt: null } });
  if (!acc) throw AppError.notFound('Conta WhatsApp');
  if (acc.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  if (acc.apiKey) {
    try { await evolution.logout(acc.apiKey); } catch (err) {
      logger.warn({ err: (err as Error).message, instanceId: acc.instanceId }, 'logout Evolution falhou');
    }
  }
  return prisma.whatsAppAccount.update({ where: { id }, data: { status: 'DISCONNECTED' } });
}

export async function deleteAccount(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const acc = await prisma.whatsAppAccount.findFirst({ where: { id, deletedAt: null } });
  if (!acc) throw AppError.notFound('Conta WhatsApp');
  if (acc.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  try { await evolution.deleteInstance(acc.instanceId); } catch (err) {
    logger.warn({ err: (err as Error).message, instanceId: acc.instanceId }, 'delete Evolution falhou');
  }
  await prisma.whatsAppAccount.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function forceConnect(actor: AuthenticatedUser, id: string, input: { phone?: string }) {
  if (!actor.tenantId) throw AppError.forbidden();
  const acc = await prisma.whatsAppAccount.findFirst({ where: { id, deletedAt: null } });
  if (!acc) throw AppError.notFound('Conta WhatsApp');
  if (acc.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return prisma.whatsAppAccount.update({
    where: { id },
    data: { status: 'CONNECTED', phone: input.phone || acc.phone, lastSyncAt: new Date() },
  });
}

// ===== Webhook (sem auth) =====

export async function handleIncomingMessage(payload: any) {
  if (!payload || payload.event !== 'Message') return { ignored: true };
  const { instance: instanceId, data } = payload;
  if (!instanceId || !data) return { ignored: true, reason: 'no_data' };

  const account = await prisma.whatsAppAccount.findFirst({
    where: { instanceId, deletedAt: null },
  });
  if (!account) {
    logger.warn({ instanceId }, 'webhook: conta não encontrada');
    return { ignored: true, reason: 'no_account' };
  }

  // Evolution Go: key.remoteJid, key.fromMe, key.id; messageType vem do data.Message type
  const key = data.key || data.Key || {};
  const fromMe: boolean = !!(key.fromMe ?? data.FromMe);
  const remoteJid: string = key.remoteJid || data.Chat || '';
  const isGroup = remoteJid.endsWith('@g.us');
  if (isGroup) {
    logger.info({ instanceId, remoteJid }, 'webhook: mensagem de grupo ignorada na V1');
    return { ignored: true, reason: 'group' };
  }

  const phone = normalizePhone(remoteJid);
  if (!phone) return { ignored: true, reason: 'no_phone' };

  const pushName = data.pushName || data.PushName;

  const contact = await prisma.contact.upsert({
    where: { tenantId_phone: { tenantId: account.tenantId, phone } },
    update: pushName && !fromMe ? { name: pushName } : {},
    create: {
      tenantId: account.tenantId,
      phone,
      name: pushName || phone,
      source: 'whatsapp',
    },
  });

  const conversation = await prisma.conversation.upsert({
    where: { whatsappAccountId_contactId: { whatsappAccountId: account.id, contactId: contact.id } },
    update: {
      lastMessageAt: new Date(),
      lastMessagePreview: extractContent(data).slice(0, 120),
      unreadCount: fromMe ? undefined : { increment: 1 },
    },
    create: {
      tenantId: account.tenantId,
      whatsappAccountId: account.id,
      contactId: contact.id,
      status: 'WITH_AI',
      lastMessageAt: new Date(),
      lastMessagePreview: extractContent(data).slice(0, 120),
      unreadCount: fromMe ? 0 : 1,
    },
  });

  const msg = await prisma.message.create({
    data: {
      tenantId: account.tenantId,
      conversationId: conversation.id,
      senderType: fromMe ? 'USER' : 'CONTACT',
      direction: fromMe ? 'OUTBOUND' : 'INBOUND',
      type: mapMessageType(data.Message?.type || data.Type),
      content: extractContent(data),
      externalId: key.id || data.ID,
    },
  });

  logger.info({ conversationId: conversation.id, fromMe, messageId: msg.id }, 'webhook: mensagem salva');

  // Notificações in-app (apenas mensagens recebidas)
  if (!fromMe) {
    import('../notifications/notifications.service').then(({ notifyTenantStaff, notify }) => {
      const preview = extractContent(data).slice(0, 80);
      // Se conversa está com humano atribuído, notifica só ele
      if (conversation.assignedUserId) {
        notify({
          tenantId: account.tenantId,
          userId: conversation.assignedUserId,
          type: 'NEW_MESSAGE',
          title: `Nova mensagem de ${contact.name || phone}`,
          body: preview,
          link: `/inbox/${conversation.id}`,
          icon: 'MessageSquare',
          metadata: { conversationId: conversation.id, contactId: contact.id },
        });
      } else {
        // Sem agente atribuído: notifica todo o staff
        notifyTenantStaff({
          tenantId: account.tenantId,
          type: 'NEW_CONVERSATION',
          title: `Nova conversa: ${contact.name || phone}`,
          body: preview,
          link: `/inbox/${conversation.id}`,
          icon: 'MessageSquare',
          metadata: { conversationId: conversation.id, contactId: contact.id },
        });
      }
    }).catch((err: Error) => logger.error({ err: err.message }, 'falha ao importar notifications'));
  }

  // Dispara Kairos IA se conversa WITH_AI e mensagem recebida
  if (!fromMe && conversation.status === 'WITH_AI' && !conversation.aiPaused) {
    // Import dinâmico pra não criar ciclo
    import('../hermes/hermes.service').then(({ runKairosIA }) => {
      runKairosIA({
        tenantId: account.tenantId,
        userMessage: extractContent(data),
        conversationId: conversation.id,
        contactId: contact.id,
      }).then((result: { reply: string | null; toolCalls: number; handoff: boolean }) => {
        logger.info({ conversationId: conversation.id, reply: !!result.reply, tools: result.toolCalls, handoff: result.handoff }, 'Kairos IA processado');
      }).catch((err: Error) => {
        logger.error({ err: err.message, conversationId: conversation.id }, 'Kairos IA falhou');
      });
    }).catch((err: Error) => logger.error({ err: err.message }, 'falha ao importar hermes'));
  }

  return { conversationId: conversation.id, messageId: msg.id };
}

export async function handleConnectionUpdate(payload: any) {
  if (!payload) return { ignored: true };
  const instanceId = payload.instance || payload.instanceId;
  if (!instanceId) return { ignored: true };
  const account = await prisma.whatsAppAccount.findFirst({ where: { instanceId, deletedAt: null } });
  if (!account) return { ignored: true };

  const data = payload.data || {};
  const state = (data.state || data.status || '').toString().toLowerCase();
  const status = state === 'open' ? 'CONNECTED' : state === 'connecting' ? 'CONNECTING' : 'DISCONNECTED';
  const phone = data.jid ? normalizePhone(data.jid) : account.phone;

  await prisma.whatsAppAccount.update({
    where: { id: account.id },
    data: { status, phone, lastSyncAt: new Date() },
  });
  logger.info({ instanceId, state, status }, 'webhook: connection.update');
  return { ok: true };
}

function extractContent(data: any): string {
  if (!data) return '';
  if (typeof data.message === 'string') return data.message;
  if (data.message?.conversation) return data.message.conversation;
  if (data.Message?.conversation) return data.Message.conversation;
  if (data.message?.extendedTextMessage?.text) return data.message.extendedTextMessage.text;
  if (data.Message?.extendedTextMessage?.text) return data.Message.extendedTextMessage.text;
  if (data.message?.imageMessage?.caption) return data.message.imageMessage.caption;
  if (data.message?.videoMessage?.caption) return data.message.videoMessage.caption;
  if (data.message?.documentMessage?.caption) return data.message.documentMessage.caption;
  return '';
}

function mapMessageType(t: string): 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | 'CONTACT' {
  const k = (t || '').toLowerCase();
  if (k.includes('image')) return 'IMAGE';
  if (k.includes('audio') || k.includes('ptt')) return 'AUDIO';
  if (k.includes('video')) return 'VIDEO';
  if (k.includes('document')) return 'DOCUMENT';
  if (k.includes('location')) return 'LOCATION';
  if (k.includes('contact') || k.includes('vcard')) return 'CONTACT';
  return 'TEXT';
}
