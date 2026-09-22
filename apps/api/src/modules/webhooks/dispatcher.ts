/**
 * Webhook dispatcher — outbound (CRM → apps externos).
 *
 * Responsabilidades:
 *   - `emit(event, tenantId, payload)` — publica evento (fire-and-forget).
 *     Para cada Application do tenant inscrita no evento, cria WebhookDelivery
 *     com status PENDING e dispara o worker.
 *   - `dispatchDelivery(deliveryId)` — pega 1 delivery do DB, busca o secret
 *     do WebhookEndpoint, assina, POSTa, atualiza status.
 *   - `retryWorker()` — varre deliveries FAILED com nextAttemptAt <= now()
 *     e re-tenta com backoff exponencial.
 *
 * Por que fila no DB e não Redis/BullMQ:
 *   - MVP funciona em 1 instância (single-process)
 *   - Tabela WebhookDelivery já existe, basta ler/escrever
 *   - Backoff persistente sobrevive a restart
 *   - Quando virar multi-instância, trocar pra BullMQ (interface mantida)
 */

import { prisma } from '@kairos-crm/database';
import { logger } from '../../lib/logger';
import { decrypt } from '../../lib/crypto';
import { signWebhookPayload, generateDeliveryId } from '../../lib/webhook-signature';
import type { WebhookEvent } from '../../lib/webhook-events';

// =====================================================
// Constantes de retry
// =====================================================

const MAX_ATTEMPTS = 6;
const REQUEST_TIMEOUT_MS = 10_000;

// Backoff: 30s, 2min, 10min, 1h, 6h, 24h (em segundos)
const BACKOFF_SECONDS = [30, 120, 600, 3600, 21_600, 86_400];

function nextBackoff(attempts: number): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const idx = Math.min(attempts, BACKOFF_SECONDS.length - 1);
  const seconds = BACKOFF_SECONDS[idx];
  return new Date(Date.now() + seconds * 1000);
}

// =====================================================
// emit() — publica evento
// =====================================================

export interface EmitPayload {
  [key: string]: any;
}

export async function emit(event: WebhookEvent, tenantId: string, data: EmitPayload): Promise<number> {
  // Busca endpoints inscritos nesse evento + ativos + app ativa + tenant ativo
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      active: true,
      events: { has: event },
      application: {
        tenantId,
        status: 'ACTIVE',
        revokedAt: null,
      },
    },
    select: {
      id: true,
      url: true,
      secretEncrypted: true,
      applicationId: true,
    },
  });

  if (endpoints.length === 0) return 0;

  // Cria deliveries em batch
  const enrichedPayload = {
    event,
    occurredAt: new Date().toISOString(),
    tenantId,
    deliveryId: generateDeliveryId(),
    data,
  };

  const deliveries = await prisma.$transaction(
    endpoints.map((ep) =>
      prisma.webhookDelivery.create({
        data: {
          endpointId: ep.id,
          event,
          payload: enrichedPayload,
          status: 'PENDING',
          nextAttemptAt: new Date(), // tenta imediatamente
        },
      }),
    ),
  );

  // Dispara worker pra cada delivery (fire-and-forget)
  for (const d of deliveries) {
    // setImmediate pra não bloquear o caller
    setImmediate(() => {
      dispatchDelivery(d.id).catch((err) =>
        logger.warn({ err: (err as Error).message, deliveryId: d.id }, 'dispatch failed'),
      );
    });
  }

  logger.info(
    { event, tenantId, deliveries: deliveries.length },
    'webhook event emitted',
  );

  return deliveries.length;
}

// =====================================================
// dispatchDelivery() — processa UMA delivery
// =====================================================

export async function dispatchDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      endpoint: {
        select: {
          id: true, url: true, secretEncrypted: true, active: true,
          application: { select: { id: true, status: true, tenantId: true } },
        },
      },
    },
  });

  if (!delivery || !delivery.endpoint) {
    logger.warn({ deliveryId }, 'delivery or endpoint not found');
    return;
  }

  if (!delivery) {
    logger.warn({ deliveryId }, 'delivery not found');
    return;
  }
  if (delivery.status === 'DELIVERED') return;
  if (delivery.status === 'FAILED' && !delivery.nextAttemptAt) return;
  if (delivery.nextAttemptAt && delivery.nextAttemptAt > new Date()) return;

  // Marca como DELIVERING (evita re-processamento por outro worker)
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'DELIVERING',
      lastAttemptAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  // Endpoint desativado entre criação e dispatch? Cancela.
  if (!delivery.endpoint.active || delivery.endpoint.application.status !== 'ACTIVE') {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'FAILED', failedReason: 'endpoint_inactive' },
    });
    return;
  }

  // Decrypt secret do endpoint
  let secret: string;
  try {
    if (!delivery.endpoint.secretEncrypted) {
      throw new Error('endpoint sem secretEncrypted');
    }
    secret = decrypt(delivery.endpoint.secretEncrypted);
  } catch (err) {
    await markFailedPermanently(deliveryId, 'decrypt_failed: ' + (err as Error).message);
    return;
  }

  // Serializa payload + assina
  const body = JSON.stringify(delivery.payload);
  const signature = signWebhookPayload(secret, body);

  // POST
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(delivery.endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Kairos-CRM-Webhooks/1.0',
        'X-Kairos-Signature': signature,
        'X-Kairos-Event': delivery.event,
        'X-Kairos-Delivery': delivery.id,
        'X-Kairos-Attempt': String(delivery.attempts + 1),
      },
      body,
      signal: controller.signal,
    });

    const responseBody = (await res.text()).slice(0, 1024); // 1KB cap

    if (res.status >= 200 && res.status < 300) {
      // Sucesso
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          responseStatus: res.status,
          responseBody,
          nextAttemptAt: null,
          failedReason: null,
        },
      });

      await logAudit(delivery.endpoint.application.id, 'webhook.delivered', {
        deliveryId, event: delivery.event, responseStatus: res.status,
      });

      logger.info(
        { deliveryId, event: delivery.event, endpointId: delivery.endpoint.id, status: res.status },
        'webhook delivered',
      );
    } else {
      // 4xx/5xx — retry
      await scheduleRetry(deliveryId, `http_${res.status}`, responseBody);
    }
  } catch (err) {
    const reason = (err as Error).name === 'AbortError' ? 'timeout' : (err as Error).message;
    await scheduleRetry(deliveryId, reason);
  } finally {
    clearTimeout(timer);
  }
}

async function scheduleRetry(
  deliveryId: string,
  reason: string,
  responseBody?: string,
): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { attempts: true },
  });
  if (!delivery) return;

  const nextAt = nextBackoff(delivery.attempts);
  if (!nextAt) {
    await markFailedPermanently(deliveryId, reason, responseBody);
    return;
  }

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'PENDING',
      failedReason: reason,
      responseStatus: null,
      responseBody: responseBody ?? null,
      nextAttemptAt: nextAt,
    },
  });

  logger.warn(
    { deliveryId, attempts: delivery.attempts, nextAt, reason },
    'webhook delivery failed, scheduled retry',
  );
}

async function markFailedPermanently(
  deliveryId: string,
  reason: string,
  responseBody?: string,
): Promise<void> {
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'FAILED',
      failedReason: reason,
      responseBody: responseBody ?? null,
      nextAttemptAt: null,
    },
  });
  logger.error({ deliveryId, reason }, 'webhook delivery failed permanently (DLQ)');
}

// =====================================================
// retryWorker() — varre deliveries pendentes
// =====================================================

let workerHandle: NodeJS.Timeout | null = null;

export function startWebhookWorker(intervalMs = 30_000): void {
  if (workerHandle) return;
  workerHandle = setInterval(() => {
    runWorkerOnce().catch((err) =>
      logger.warn({ err: (err as Error).message }, 'webhook worker tick failed'),
    );
  }, intervalMs);
  workerHandle.unref(); // não impede shutdown
  logger.info({ intervalMs }, 'webhook retry worker started');
}

export function stopWebhookWorker(): void {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}

export async function runWorkerOnce(limit = 20): Promise<number> {
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: new Date() } },
      ],
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (due.length === 0) return 0;

  // Processa em paralelo (cada um atualiza DB com status, então é safe)
  await Promise.allSettled(
    due.map((d) =>
      dispatchDelivery(d.id).catch((err) =>
        logger.warn({ err: (err as Error).message, deliveryId: d.id }, 'worker dispatch failed'),
      ),
    ),
  );

  return due.length;
}

// =====================================================
// Audit log helper
// =====================================================

async function logAudit(
  applicationId: string,
  action: string,
  metadata: Record<string, any>,
): Promise<void> {
  await prisma.applicationAuditLog.create({
    data: {
      applicationId,
      action,
      metadata,
    },
  }).catch((err) =>
    logger.warn({ err: (err as Error).message }, 'audit log failed'),
  );
}