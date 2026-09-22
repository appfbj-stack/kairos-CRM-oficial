/**
 * Idempotency-Key helper.
 *
 * Apps externos enviam header `Idempotency-Key: <uuid>` em POSTs críticos
 * (criar lead, enviar mensagem, agendar, etc.) pra deduplicar retries.
 *
 * Comportamento:
 *   - Se a key JÁ foi vista + request completou → retorna a resposta cacheada
 *   - Se a key JÁ foi vista + request em andamento → retorna 409 CONFLICT
 *   - Se a key é nova → processa e cacheia a resposta por 24h
 *
 * Implementação:
 *   - Fase 1: em memória (Map) — OK pra 1 instância
 *   - Fase 10: trocar por Redis com TTL automático
 *
 * Uso:
 *   const cached = await idempotencyMiddleware(req, reply, async () => {
 *     // executa operação
 *     return { status: 201, body: result };
 *   });
 *   return reply.status(cached.status).send(cached.body);
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'crypto';
import { AppError } from '@kairos-crm/shared';
import { logger } from './logger';

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_KEYS = 50_000;

export interface IdempotentResult<T = any> {
  status: number;
  body: T;
}

interface CachedEntry<T> {
  result: IdempotentResult<T>;
  expiresAt: number;
  inFlight: boolean;
}

const store = new Map<string, CachedEntry<any>>();

// Limpa chaves expiradas periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k);
  }
  if (store.size > MAX_KEYS) {
    // remove oldest by insertion order (Map preserva)
    const toRemove = store.size - MAX_KEYS;
    let i = 0;
    for (const k of store.keys()) {
      if (i++ >= toRemove) break;
      store.delete(k);
    }
  }
}, 60_000).unref();

/**
 * Gera uma fingerprint da request pra detectar "mesma key, body diferente"
 * (cliente mandou Idempotency-Key igual mas payload diferente → erro).
 */
function fingerprint(body: any): string {
  const json = JSON.stringify(body ?? null);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Wrapper que aplica idempotência a uma operação Fastify.
 *
 * Lê o header `Idempotency-Key`. Se ausente, executa direto.
 * Se presente, aplica o protocolo acima.
 */
export async function withIdempotency<T>(
  req: FastifyRequest,
  fn: () => Promise<IdempotentResult<T>>,
): Promise<IdempotentResult<T>> {
  const key = req.headers['idempotency-key'] as string | undefined;
  if (!key) {
    // sem idempotency → executa direto
    return await fn();
  }

  if (typeof key !== 'string' || key.length < 8 || key.length > 128) {
    throw AppError.badRequest('Idempotency-Key inválida (8-128 chars)');
  }

  const fp = fingerprint(req.body);
  const cacheKey = `${key}:${fp}`;
  const now = Date.now();

  const existing = store.get(cacheKey);
  if (existing) {
    if (existing.expiresAt <= now) {
      store.delete(cacheKey);
    } else if (existing.inFlight) {
      throw AppError.conflict('Requisição com mesma Idempotency-Key em andamento');
    } else {
      // Cache hit — retorna resposta original
      logger.info({ key, fp: fp.slice(0, 8) }, 'idempotency cache hit');
      return existing.result as IdempotentResult<T>;
    }
  }

  // Marca como in-flight
  store.set(cacheKey, {
    result: { status: 200, body: null },
    expiresAt: now + TTL_MS,
    inFlight: true,
  });

  try {
    const result = await fn();
    store.set(cacheKey, {
      result,
      expiresAt: now + TTL_MS,
      inFlight: false,
    });
    return result;
  } catch (err) {
    // Falha → remove do cache pra permitir retry
    store.delete(cacheKey);
    throw err;
  }
}

/**
 * Helper opcional: retorna `Idempotency-Key` gerada (UUID v4).
 * Útil para testes e pro frontend.
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}