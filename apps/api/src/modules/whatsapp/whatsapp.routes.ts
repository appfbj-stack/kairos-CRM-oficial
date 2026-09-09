import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHmac } from 'crypto';
import { authenticate } from '../../middleware/auth';
import { injectTenantContext } from '../../middleware/tenant';
import { requireRole } from '../../middleware/permissions';
import { sendError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import {
  createAccountSchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  sendMessageSchema,
} from './whatsapp.schema';
import * as accounts from './whatsapp.service';
import * as conversations from './conversations.service';

export async function whatsappRoutes(app: FastifyInstance) {
  // ===== Webhook (com HMAC signature) — registra primeiro, antes do addHook =====
  app.post('/api/whatsapp/webhook', async (req, reply) => {
    try {
      // Validação de assinatura: Evolution Go envia header `webhookSignature`
      // se EVOLUTION_AUTHENTICATION_WEBHOOK=true e EVOLUTION_WEBHOOK_SECRET=<secret>
      // A assinatura é HMAC-SHA256 do RAW body com o secret.
      // Fastify normaliza headers pra lowercase.
      const sigHeader = (req.headers['webhooksignature'] || req.headers['x-webhook-signature']) as string | undefined;
      const webhookSecret = env.EVOLUTION_WEBHOOK_SECRET;
      if (webhookSecret) {
        if (!sigHeader) {
          logger.warn({ ip: req.ip }, 'webhook sem assinatura');
          return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Assinatura do webhook ausente' } });
        }
        // Usa o raw body se disponível (exato que veio no POST), senão re-serializa
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);
        const expected = createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
        if (sigHeader !== expected) {
          logger.warn({ ip: req.ip, got: sigHeader.slice(0, 8) + '...' }, 'webhook assinatura inválida');
          return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Assinatura do webhook inválida' } });
        }
      }

      const body = req.body as any;
      logger.info({ event: body?.event, instance: body?.instance }, 'webhook recebido');
      if (body?.event === 'messages.upsert') {
        const result = await accounts.handleIncomingMessage(body);
        return reply.send(result);
      }
      if (body?.event === 'connection.update' || body?.event === 'connection-update') {
        const result = await accounts.handleConnectionUpdate(body);
        return reply.send(result);
      }
      return reply.send({ ignored: true, reason: 'unknown_event' });
    } catch (err) {
      logger.error({ err }, 'webhook error');
      return reply.status(500).send({ error: { code: 'WEBHOOK_ERROR', message: (err as Error).message } });
    }
  });

  // ===== Sub-app com auth/tenant para todas as rotas autenticadas =====
  await app.register(async (subApp) => {
    subApp.addHook('preHandler', authenticate);
    subApp.addHook('preHandler', injectTenantContext);

    // /api/whatsapp/accounts
    subApp.get('/api/whatsapp/accounts', async (req, reply) => {
      try {
        const user = (req as any).user;
        return reply.send(await accounts.listAccounts(user));
      } catch (err) { return sendError(reply, err); }
    });

    subApp.post('/api/whatsapp/accounts',
      { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          const input = createAccountSchema.parse(req.body);
          return reply.status(201).send(await accounts.createAccount(user, input));
        } catch (err) { return sendError(reply, err); }
      });

    subApp.get<{ Params: { id: string } }>('/api/whatsapp/accounts/:id', async (req, reply) => {
      try {
        const user = (req as any).user;
        return reply.send(await accounts.getAccount(user, req.params.id));
      } catch (err) { return sendError(reply, err); }
    });

    subApp.post<{ Params: { id: string } }>('/api/whatsapp/accounts/:id/connect',
      { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          return reply.send(await accounts.connectAccount(user, req.params.id));
        } catch (err) { return sendError(reply, err); }
      });

    subApp.post<{ Params: { id: string } }>('/api/whatsapp/accounts/:id/refresh',
      async (req, reply) => {
        try {
          const user = (req as any).user;
          return reply.send(await accounts.refreshStatus(user, req.params.id));
        } catch (err) { return sendError(reply, err); }
      });

    subApp.post<{ Params: { id: string } }>('/api/whatsapp/accounts/:id/force-connect',
      { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          const body = (req.body || {}) as { phone?: string };
          return reply.send(await accounts.forceConnect(user, req.params.id, body));
        } catch (err) { return sendError(reply, err); }
      });

    subApp.post<{ Params: { id: string } }>('/api/whatsapp/accounts/:id/logout',
      { preHandler: [requireRole('MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          return reply.send(await accounts.logoutAccount(user, req.params.id));
        } catch (err) { return sendError(reply, err); }
      });

    subApp.delete<{ Params: { id: string } }>('/api/whatsapp/accounts/:id',
      { preHandler: [requireRole('TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          await accounts.deleteAccount(user, req.params.id);
          return reply.status(204).send();
        } catch (err) { return sendError(reply, err); }
      });

    // /api/inbox
    subApp.get('/api/inbox', async (req, reply) => {
      try {
        const user = (req as any).user;
        const q = listConversationsQuerySchema.parse(req.query);
        return reply.send(await conversations.listConversations(user, q));
      } catch (err) { return sendError(reply, err); }
    });

    subApp.get<{ Params: { id: string } }>('/api/inbox/:id', async (req, reply) => {
      try {
        const user = (req as any).user;
        return reply.send(await conversations.getConversation(user, req.params.id));
      } catch (err) { return sendError(reply, err); }
    });

    subApp.get<{ Params: { id: string } }>('/api/inbox/:id/messages', async (req, reply) => {
      try {
        const user = (req as any).user;
        const q = listMessagesQuerySchema.parse(req.query);
        return reply.send(await conversations.listMessages(user, req.params.id, q));
      } catch (err) { return sendError(reply, err); }
    });

    subApp.post<{ Params: { id: string } }>('/api/inbox/:id/messages', async (req, reply) => {
      try {
        const user = (req as any).user;
        const input = sendMessageSchema.parse(req.body);
        return reply.status(201).send(await conversations.sendMessage(user, req.params.id, input.content));
      } catch (err) { return sendError(reply, err); }
    });

    subApp.post<{ Params: { id: string } }>('/api/inbox/:id/takeover',
      { preHandler: [requireRole('AGENT', 'MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')] },
      async (req, reply) => {
        try {
          const user = (req as any).user;
          return reply.send(await conversations.takeoverConversation(user, req.params.id));
        } catch (err) { return sendError(reply, err); }
      });

    subApp.post<{ Params: { id: string } }>('/api/inbox/:id/return', async (req, reply) => {
      try {
        const user = (req as any).user;
        return reply.send(await conversations.returnToAI(user, req.params.id));
      } catch (err) { return sendError(reply, err); }
    });

    subApp.post<{ Params: { id: string } }>('/api/inbox/:id/close', async (req, reply) => {
      try {
        const user = (req as any).user;
        return reply.send(await conversations.closeConversation(user, req.params.id));
      } catch (err) { return sendError(reply, err); }
    });
  });
}
