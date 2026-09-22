/**
 * CRUD de Webhook subscriptions (apps externos).
 *
 * Rotas autenticadas via authenticateExternal (Bearer token).
 * Cada app gerencia os próprios endpoints.
 *
 * Endpoints:
 *   GET    /api/v1/external/webhooks                 Lista endpoints do app
 *   POST   /api/v1/external/webhooks                 Cria endpoint (retorna secret 1x)
 *   GET    /api/v1/external/webhooks/:id             Detalha 1 endpoint
 *   PATCH  /api/v1/external/webhooks/:id             Atualiza URL/eventos/active
 *   DELETE /api/v1/external/webhooks/:id             Desativa (soft)
 *   GET    /api/v1/external/webhooks/:id/deliveries Lista deliveries recentes (debug)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '@kairos-crm/shared';
import { prisma } from '@kairos-crm/database';
import { createHash } from 'crypto';
import { encrypt } from '../../lib/crypto';
import {
  generateWebhookSecret,
  hashWebhookSecret,
  webhookSecretLastFour,
} from '../../lib/webhook-signature';
import { WEBHOOK_EVENTS } from '../../lib/webhook-events';
import { authenticateExternal } from '../../middleware/external-auth';
import { sendError } from '../../lib/errors';
import { logger } from '../../lib/logger';

const createSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(50),
  description: z.string().max(200).optional(),
});

const updateSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(50).optional(),
  active: z.boolean().optional(),
  description: z.string().max(200).optional(),
});

export async function externalWebhookRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (sub) => {
    sub.addHook('preHandler', authenticateExternal);

    // GET /api/v1/external/webhooks
    sub.get('/api/v1/external/webhooks', async (req, reply) => {
      try {
        const ctx = req.externalApp!;
        const endpoints = await prisma.webhookEndpoint.findMany({
          where: { applicationId: ctx.applicationId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, url: true, events: true, active: true,
            description: true, secretLastFour: true,
            createdAt: true, updatedAt: true,
            _count: { select: { deliveries: true } },
          },
        });
        return reply.send({ data: endpoints });
      } catch (err) {
        return sendError(reply, err);
      }
    });

    // POST /api/v1/external/webhooks
    sub.post('/api/v1/external/webhooks', async (req, reply) => {
      try {
        const ctx = req.externalApp!;
        const input = createSchema.parse(req.body);

        const secret = generateWebhookSecret();
        const secretEncrypted = encrypt(secret);
        const secretHash = hashWebhookSecret(secret);
        const secretLastFour = webhookSecretLastFour(secret);

        const endpoint = await prisma.webhookEndpoint.create({
          data: {
            applicationId: ctx.applicationId,
            url: input.url,
            events: input.events,
            description: input.description,
            secretHash,
            secretEncrypted,
            secretLastFour,
          },
          select: {
            id: true, url: true, events: true, active: true,
            description: true, secretLastFour: true,
            createdAt: true,
          },
        });

        await prisma.applicationAuditLog.create({
          data: {
            applicationId: ctx.applicationId,
            apiKeyId: ctx.apiKeyId,
            action: 'webhook.created',
            resource: 'webhook_endpoint',
            resourceId: endpoint.id,
            metadata: { events: input.events },
          },
        });

        logger.info(
          { endpointId: endpoint.id, applicationId: ctx.applicationId },
          'webhook endpoint created',
        );

        // Retorna secret em claro 1x só
        return reply.status(201).send({
          ...endpoint,
          secret, // ÚNICA VEZ
        });
      } catch (err) {
        return sendError(reply, err);
      }
    });

    // GET /api/v1/external/webhooks/:id
    sub.get<{ Params: { id: string } }>(
      '/api/v1/external/webhooks/:id',
      async (req, reply) => {
        try {
          const ctx = req.externalApp!;
          const endpoint = await prisma.webhookEndpoint.findFirst({
            where: { id: req.params.id, applicationId: ctx.applicationId },
            select: {
              id: true, url: true, events: true, active: true,
              description: true, secretLastFour: true,
              createdAt: true, updatedAt: true,
            },
          });
          if (!endpoint) throw AppError.notFound('Webhook');
          return reply.send(endpoint);
        } catch (err) {
          return sendError(reply, err);
        }
      },
    );

    // PATCH /api/v1/external/webhooks/:id
    sub.patch<{ Params: { id: string } }>(
      '/api/v1/external/webhooks/:id',
      async (req, reply) => {
        try {
          const ctx = req.externalApp!;
          const input = updateSchema.parse(req.body);

          const existing = await prisma.webhookEndpoint.findFirst({
            where: { id: req.params.id, applicationId: ctx.applicationId },
          });
          if (!existing) throw AppError.notFound('Webhook');

          const updated = await prisma.webhookEndpoint.update({
            where: { id: req.params.id },
            data: {
              ...(input.url !== undefined && { url: input.url }),
              ...(input.events !== undefined && { events: input.events }),
              ...(input.active !== undefined && { active: input.active }),
              ...(input.description !== undefined && { description: input.description }),
            },
            select: {
              id: true, url: true, events: true, active: true,
              description: true, secretLastFour: true,
              updatedAt: true,
            },
          });

          await prisma.applicationAuditLog.create({
            data: {
              applicationId: ctx.applicationId,
              apiKeyId: ctx.apiKeyId,
              action: 'webhook.updated',
              resource: 'webhook_endpoint',
              resourceId: updated.id,
              metadata: input,
            },
          });

          return reply.send(updated);
        } catch (err) {
          return sendError(reply, err);
        }
      },
    );

    // DELETE /api/v1/external/webhooks/:id (soft — apenas desativa)
    sub.delete<{ Params: { id: string } }>(
      '/api/v1/external/webhooks/:id',
      async (req, reply) => {
        try {
          const ctx = req.externalApp!;
          const existing = await prisma.webhookEndpoint.findFirst({
            where: { id: req.params.id, applicationId: ctx.applicationId },
          });
          if (!existing) throw AppError.notFound('Webhook');

          await prisma.webhookEndpoint.update({
            where: { id: req.params.id },
            data: { active: false },
          });

          await prisma.applicationAuditLog.create({
            data: {
              applicationId: ctx.applicationId,
              apiKeyId: ctx.apiKeyId,
              action: 'webhook.disabled',
              resource: 'webhook_endpoint',
              resourceId: req.params.id,
            },
          });

          return reply.status(204).send();
        } catch (err) {
          return sendError(reply, err);
        }
      },
    );

    // GET /api/v1/external/webhooks/:id/deliveries (debug)
    sub.get<{ Params: { id: string } }>(
      '/api/v1/external/webhooks/:id/deliveries',
      async (req, reply) => {
        try {
          const ctx = req.externalApp!;
          const existing = await prisma.webhookEndpoint.findFirst({
            where: { id: req.params.id, applicationId: ctx.applicationId },
            select: { id: true },
          });
          if (!existing) throw AppError.notFound('Webhook');

          const deliveries = await prisma.webhookDelivery.findMany({
            where: { endpointId: req.params.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true, event: true, status: true,
              attempts: true, responseStatus: true,
              failedReason: true, createdAt: true,
              deliveredAt: true, lastAttemptAt: true,
            },
          });
          return reply.send({ data: deliveries });
        } catch (err) {
          return sendError(reply, err);
        }
      },
    );
  });
}