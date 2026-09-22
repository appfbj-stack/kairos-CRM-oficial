/**
 * Autenticação da API externa.
 *
 * Fluxo POST /auth/token:
 *   1. Headers obrigatórios: X-Kairos-App-Id, X-Kairos-Key-Id, X-Kairos-Timestamp, X-Kairos-Signature
 *   2. Body JSON: { keyId, timestamp } (deve bater com headers)
 *   3. Lookup Application + ApiKey (com secretEncrypted)
 *   4. Decrypt secret via AES-256-GCM (master key do env)
 *   5. Verify HMAC SHA-256 (constant-time, ±300s window)
 *   6. Se válido: gera authToken opaco, persiste hash, retorna
 *
 * GET /me (autenticado):
 *   - Header: Authorization: Bearer <authToken>
 *   - Retorna: application + tenant + effective scopes
 *
 * POST /auth/refresh:
 *   - Re-issue: nova chamada /auth/token com novo HMAC
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '@kairos-crm/shared';
import { prisma } from '@kairos-crm/database';
import { verify as verifyHmac } from '../../lib/hmac';
import { decrypt } from '../../lib/crypto';
import { issueToken, validateApiKeyPrefix } from '../../lib/external-token';
import { authenticateExternal } from '../../middleware/external-auth';
import { sendError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';

const tokenRequestSchema = z.object({
  keyId: z.string().min(8).max(32),
  timestamp: z.number().int().positive(),
});

export async function externalAuthRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/token — sem auth prévia (a validação É o HMAC)
  app.post('/api/v1/external/auth/token', async (req, reply) => {
    try {
      const appIdHeader = req.headers['x-kairos-app-id'] as string | undefined;
      const keyIdHeader = req.headers['x-kairos-key-id'] as string | undefined;
      const tsHeader = req.headers['x-kairos-timestamp'] as string | undefined;
      const sigHeader = req.headers['x-kairos-signature'] as string | undefined;

      if (!appIdHeader || !keyIdHeader || !tsHeader || !sigHeader) {
        throw AppError.badRequest(
          'Headers obrigatórios: X-Kairos-App-Id, X-Kairos-Key-Id, X-Kairos-Timestamp, X-Kairos-Signature',
        );
      }

      // Master key MUST estar setada (senao crypto.ts joga erro)
      if (!env.KAIROS_API_MASTER_KEY) {
        logger.error('KAIROS_API_MASTER_KEY não configurada — impossível descriptografar secrets');
        throw AppError.internal('Servidor mal configurado');
      }

      // Body esperado (string exata usada pra assinar)
      const bodyParsed = tokenRequestSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        throw AppError.badRequest('Body inválido');
      }
      const { keyId, timestamp } = bodyParsed.data;

      if (String(timestamp) !== tsHeader) {
        throw AppError.badRequest('timestamp do body não confere com header');
      }
      if (validateApiKeyPrefix(keyId) !== keyIdHeader) {
        throw AppError.badRequest('keyId do body não confere com header');
      }

      // Lookup Application + ApiKey
      const application = await prisma.application.findUnique({
        where: { id: appIdHeader },
        include: {
          apiKeys: {
            where: {
              prefix: keyId,
              revokedAt: null,
            },
          },
        },
      });

      if (!application) {
        throw AppError.unauthenticated('Aplicação não encontrada');
      }
      if (application.status !== 'ACTIVE' || application.revokedAt) {
        throw AppError.forbidden('Aplicação não está ativa');
      }

      const apiKey = application.apiKeys[0];
      if (!apiKey) {
        throw AppError.unauthenticated('ApiKey não encontrada ou revogada');
      }
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        throw AppError.unauthenticated('ApiKey expirada');
      }
      if (!apiKey.secretEncrypted) {
        logger.error(
          { applicationId: application.id, apiKeyId: apiKey.id },
          'ApiKey sem secretEncrypted — chave antiga ou storage quebrado',
        );
        throw AppError.unauthenticated('ApiKey inválida — contate suporte');
      }

      // IP allowlist
      if (application.ipAllowlist && application.ipAllowlist.length > 0) {
        const ip = (req.ip || '').replace('::ffff:', '');
        const allowed = application.ipAllowlist.some((cidr: string) =>
          ipInCidr(ip, cidr),
        );
        if (!allowed) {
          throw AppError.forbidden('IP não autorizado');
        }
      }

      // Decrypt secret (AES-256-GCM)
      let secret: string;
      try {
        secret = decrypt(apiKey.secretEncrypted);
      } catch (err) {
        logger.error(
          { err: (err as Error).message, apiKeyId: apiKey.id },
          'Falha ao descriptografar secret — master key errada ou ciphertext corrompido',
        );
        throw AppError.internal('Erro ao processar ApiKey');
      }

      // Verify HMAC
      // IMPORTANTE: rawBody deve ser o que o cliente ENVIOU.
      // Fastify parseia JSON em req.body. Precisamos do raw string.
      // Vamos usar (req as any).rawBody que definimos no server.ts.
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const hmacResult = verifyHmac({
        secret,
        signature: sigHeader,
        body: rawBody,
      });

      if (!hmacResult.valid) {
        logger.warn(
          {
            applicationId: application.id,
            apiKeyId: apiKey.id,
            reason: hmacResult.reason,
            ip: req.ip,
          },
          'HMAC verification failed',
        );
        // Mensagem genérica pra não vazar info (ex: "expired" vs "mismatch")
        throw AppError.unauthenticated('Assinatura inválida');
      }

      // Issue short-lived opaque token
      const issued = issueToken({ ttl: env.EXTERNAL_AUTH_TOKEN_TTL });

      // Resolve effective scopes (key override > application)
      const effectiveScopes = apiKey.scopes.length > 0
        ? apiKey.scopes
        : application.scopes;

      // Persistir hash no DB
      await prisma.authToken.create({
        data: {
          apiKeyId: apiKey.id,
          applicationId: application.id,
          tenantId: application.tenantId,
          tokenHash: issued.tokenHash,
          scopes: effectiveScopes,
          expiresAt: issued.expiresAt,
          ipAddress: req.ip,
          userAgent: (req.headers['user-agent'] as string) ?? null,
        },
      });

      // Update lastUsedAt (best-effort)
      prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      logger.info(
        { applicationId: application.id, apiKeyId: apiKey.id, expiresAt: issued.expiresAt },
        'auth token issued',
      );

      return reply.send({
        authToken: issued.token,
        expiresIn: issued.ttlSeconds,
        expiresAt: issued.expiresAt.toISOString(),
        scopes: effectiveScopes,
        tenantId: application.tenantId,
      });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // Sub-app autenticado
  await app.register(async (sub) => {
    sub.addHook('preHandler', authenticateExternal);

    sub.get('/api/v1/external/me', async (req, reply) => {
      try {
        const ctx = req.externalApp!;
        const application = await prisma.application.findUnique({
          where: { id: ctx.applicationId },
          select: {
            id: true, name: true, slug: true, description: true,
            scopes: true, status: true, contactEmail: true,
            tenant: { select: { id: true, slug: true, name: true, status: true } },
          },
        });
        if (!application) throw AppError.notFound('Aplicação');

        return reply.send({
          application: {
            id: application.id,
            name: application.name,
            slug: application.slug,
            description: application.description,
            status: application.status,
            scopes: ctx.scopes, // effective (key override ou app)
          },
          tenant: application.tenant,
          tokenId: ctx.tokenId,
        });
      } catch (err) {
        return sendError(reply, err);
      }
    });

    // Refresh = mesma rota de token (POST /auth/token com HMAC novo)
    // Mantemos aqui só pra documentar
    sub.post('/api/v1/external/auth/refresh', async (req, reply) => {
      return reply.send({
        ok: true,
        note: 'Refresh é o mesmo que POST /auth/token com novo HMAC — não há endpoint separado',
      });
    });

    // Revoga o token atual
    sub.post('/api/v1/external/auth/revoke', async (req, reply) => {
      try {
        const ctx = req.externalApp!;
        await prisma.authToken.update({
          where: { id: ctx.tokenId },
          data: { revokedAt: new Date() },
        });
        return reply.send({ ok: true });
      } catch (err) {
        return sendError(reply, err);
      }
    });
  });
}

// =====================================================
// CIDR helpers (mantidos aqui pra evitar import circular)
// =====================================================

function ipInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip === cidr;
  const [range, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  if (!Number.isFinite(prefix) || prefix < 0) return false;
  const ipBytes = ipToBytes(ip);
  const rangeBytes = ipToBytes(range);
  if (!ipBytes || !rangeBytes || ipBytes.length !== rangeBytes.length) return false;
  const fullBytes = Math.floor(prefix / 8);
  const remainder = prefix % 8;
  for (let i = 0; i < fullBytes; i++) {
    if (ipBytes[i] !== rangeBytes[i]) return false;
  }
  if (remainder > 0 && fullBytes < ipBytes.length) {
    const mask = (0xff << (8 - remainder)) & 0xff;
    if ((ipBytes[fullBytes] & mask) !== (rangeBytes[fullBytes] & mask)) return false;
  }
  return true;
}

function ipToBytes(ip: string): Uint8Array | null {
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    const out = new Uint8Array(4);
    for (let i = 0; i < 4; i++) {
      const n = parseInt(parts[i], 10);
      if (!Number.isFinite(n) || n < 0 || n > 255) return null;
      out[i] = n;
    }
    return out;
  }
  return null;
}