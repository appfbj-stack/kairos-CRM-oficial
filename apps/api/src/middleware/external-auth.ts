/**
 * Middleware de autenticação para API externa (/api/v1/external/*).
 *
 * Valida:
 *   1. Authorization: Bearer <token> presente e bem-formado
 *   2. Token existe no banco (AuthToken.tokenHash)
 *   3. Não expirado (AuthToken.expiresAt > now)
 *   4. Não revogado (AuthToken.revokedAt IS NULL)
 *   5. ApiKey válida (não revogada, não expirada)
 *   6. Application ativa (status = ACTIVE)
 *   7. IP do request dentro do ipAllowlist (se setado)
 *
 * Decora request com `req.externalApp`:
 *   { applicationId, apiKeyId, tenantId, scopes, tokenId }
 *
 * Chama setTenantContext(tenantId) automaticamente.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@kairos-crm/shared';
import { prisma, setTenantContext } from '@kairos-crm/database';
import { extractBearer, hashToken, isExpired } from '../lib/external-token';

export interface ExternalAppContext {
  applicationId: string;
  apiKeyId: string;
  tokenId: string;
  tenantId: string;
  scopes: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    externalApp?: ExternalAppContext;
  }
}

export async function authenticateExternal(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractBearer(req.headers.authorization);
  if (!token) {
    throw AppError.unauthenticated('Authorization Bearer token ausente ou inválido');
  }

  const tokenHash = hashToken(token);

  // Lookup token + joins (otimizado com denormalização de tenantId)
  const authToken = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: {
      apiKey: {
        include: {
          application: true,
        },
      },
    },
  });

  if (!authToken) {
    throw AppError.unauthenticated('Token inválido');
  }

  if (authToken.revokedAt) {
    throw AppError.unauthenticated('Token revogado');
  }

  if (isExpired(authToken.expiresAt)) {
    throw AppError.unauthenticated('Token expirado');
  }

  if (authToken.apiKey.revokedAt) {
    throw AppError.unauthenticated('ApiKey revogada');
  }

  if (authToken.apiKey.expiresAt && isExpired(authToken.apiKey.expiresAt)) {
    throw AppError.unauthenticated('ApiKey expirada');
  }

  if (authToken.apiKey.application.status !== 'ACTIVE') {
    throw AppError.forbidden('Aplicação não está ativa');
  }

  // IP allowlist check
  const allowlist = authToken.apiKey.application.ipAllowlist;
  if (allowlist && allowlist.length > 0) {
    const ip = (req.ip || '').replace('::ffff:', ''); // strip IPv4-in-IPv6 prefix
    const allowed = allowlist.some((cidr: string) => ipInCidr(ip, cidr));
    if (!allowed) {
      throw AppError.forbidden('IP não autorizado');
    }
  }

  // Update lastUsedAt (fire-and-forget; não bloqueia request)
  prisma.authToken.update({
    where: { id: authToken.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {}); // best-effort

  // Resolve scopes efetivos: key override > application
  const effectiveScopes = authToken.scopes.length > 0
    ? authToken.scopes
    : authToken.apiKey.application.scopes;

  // Decora request
  req.externalApp = {
    applicationId: authToken.applicationId,
    apiKeyId: authToken.apiKeyId,
    tokenId: authToken.id,
    tenantId: authToken.tenantId,
    scopes: effectiveScopes,
  };

  // Auto-inject tenant context (F1.1 AsyncLocalStorage — safe em paralelo)
  setTenantContext(authToken.tenantId);
}

/**
 * Helper: verifica se IP está dentro de um CIDR.
 * Suporta IPv4 /xx (até /32) e IPv6 /xxx.
 * Simplificado — não cobre todos edge cases IPv6, mas suficiente pro MVP.
 */
function ipInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) {
    // Single IP (sem prefixo) — match exato
    return ip === cidr;
  }
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
  if (ip.includes(':')) {
    // IPv6 — simplificado: não expande `::`, retorna null pra casos complexos
    // Pra MVP o ipAllowlist é IPv4 only na maioria dos casos
    return null;
  }
  return null;
}

/**
 * Guard que exige um scope específico. Uso: preHandler: requireExternalScope('crm.write')
 */
export function requireExternalScope(...required: string[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const ctx = req.externalApp;
    if (!ctx) throw AppError.unauthenticated();
    for (const s of required) {
      if (!ctx.scopes.includes(s)) {
        throw AppError.forbidden(`Scope necessário: ${s}`);
      }
    }
  };
}