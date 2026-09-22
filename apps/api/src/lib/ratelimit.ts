/**
 * Rate limiter — wrapper Redis-ready.
 *
 * - Se REDIS_URL estiver setado, usa Redis (compartilhado entre instâncias).
 * - Caso contrário, fallback em memória (Map com TTL) — OK pra dev/1 instância.
 *
 * Design:
 *   - Sliding window simples (não leaky bucket) com janela fixa
 *   - Key = `${scope}:${identifier}` (ex: "external_app:<uuid>", "ip:1.2.3.4")
 *   - Retorna { allowed, remaining, resetAt, retryAfter }
 *
 * Quando virar worker multi-instância (Fase 10), basta setar REDIS_URL.
 *
 * Uso:
 *   const rl = await rateLimit({
 *     scope: 'external_app',
 *     identifier: app.id,
 *     limit: 600,
 *     windowMs: 60_000,
 *   });
 *   if (!rl.allowed) throw AppError.rateLimited(`Limite ${rl.limit} req/min`);
 */

import { logger } from './logger';

export interface RateLimitOptions {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // unix ms
  retryAfter?: number; // seconds (only when !allowed)
}

// =====================================================
// In-memory backend (default)
// =====================================================

interface Bucket {
  count: number;
  resetAt: number; // unix ms
}

const memoryStore = new Map<string, Bucket>();
const MAX_KEYS = 100_000; // proteção contra memory leak

function memoryCheck(opts: RateLimitOptions): RateLimitResult {
  const key = `${opts.scope}:${opts.identifier}`;
  const now = Date.now();
  const bucket = memoryStore.get(key);

  if (!bucket || bucket.resetAt <= now) {
    // Janela nova
    const resetAt = now + opts.windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    if (memoryStore.size > MAX_KEYS) {
      // Limpa keys expiradas
      for (const [k, v] of memoryStore) {
        if (v.resetAt <= now) memoryStore.delete(k);
      }
    }
    return { allowed: true, limit: opts.limit, remaining: opts.limit - 1, resetAt };
  }

  bucket.count++;
  if (bucket.count > opts.limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return {
      allowed: false,
      limit: opts.limit,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfter,
    };
  }
  return {
    allowed: true,
    limit: opts.limit,
    remaining: opts.limit - bucket.count,
    resetAt: bucket.resetAt,
  };
}

// =====================================================
// Redis backend (lazy — só carrega se REDIS_URL setado)
// =====================================================

type RedisLike = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
};

let redisClient: RedisLike | null = null;
let redisChecked = false;

async function getRedis(): Promise<RedisLike | null> {
  if (redisChecked) return redisClient;
  redisChecked = true;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    // Lazy import pra não obrigar dependência.
    // `redis` é opcional — só é carregado se REDIS_URL estiver setado.
    // Usamos Function() trick pra contornar resolução estática do TS.
    const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
    const redisModule: { createClient: (opts: { url: string }) => any } | null =
      await dynamicImport('redis').catch(() => null);
    if (!redisModule) {
      logger.warn('pacote "redis" não instalado — rate-limit cai pra memória');
      return null;
    }
    const client = redisModule.createClient({ url });
    client.on('error', (err: Error) =>
      logger.warn({ err: err.message }, 'redis rate-limit client error'),
    );
    await client.connect();
    redisClient = client as unknown as RedisLike;
    logger.info({ url: url.replace(/:[^:@]+@/, ':***@') }, 'rate-limit usando Redis');
    return redisClient;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      'falha ao conectar Redis — rate-limit cai pra memória',
    );
    return null;
  }
}

async function redisCheck(opts: RateLimitOptions, redis: RedisLike): Promise<RateLimitResult> {
  const key = `rl:${opts.scope}:${opts.identifier}`;
  const windowSec = Math.ceil(opts.windowMs / 1000);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  const ttl = await redis.ttl(key);
  const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : opts.windowMs);
  if (count > opts.limit) {
    return {
      allowed: false,
      limit: opts.limit,
      remaining: 0,
      resetAt,
      retryAfter: ttl > 0 ? ttl : windowSec,
    };
  }
  return {
    allowed: true,
    limit: opts.limit,
    remaining: opts.limit - count,
    resetAt,
  };
}

// =====================================================
// Public API
// =====================================================

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const redis = await getRedis();
  if (redis) return redisCheck(opts, redis);
  return memoryCheck(opts);
}

/**
 * Helper pra Fastify — converte RateLimitResult em headers padrão.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
  };
  if (!result.allowed && result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter);
  }
  return headers;
}