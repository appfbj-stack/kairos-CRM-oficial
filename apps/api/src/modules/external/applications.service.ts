/**
 * Service: Applications (apps externos vinculados a um tenant).
 *
 * Criar Application gera SEMPRE uma ApiKey inicial.
 * O secret da ApiKey é retornado EM CLARO apenas UMA VEZ no response —
 * depois só pode ser revogado (não read).
 *
 * Fluxo de uso (admin):
 *   1. Admin chama POST /superadmin/applications com { tenantId, name, slug, scopes }
 *   2. Backend cria Application + ApiKey
 *   3. Backend retorna { application, apiKey: { prefix, secret, secretLastFour } }
 *   4. Admin entrega o `secret` ao desenvolvedor do app (1x só)
 *   5. Desenvolvedor configura no app: KAIROS_API_KEY_ID + KAIROS_API_SECRET
 */

import { prisma } from '@kairos-crm/database';
import { AppError } from '@kairos-crm/shared';
import { encrypt } from '../../lib/crypto';
import { createHash, randomBytes } from 'crypto';

const PREFIX_NAMESPACE = 'kairos';
const KEY_ID_LENGTH = 12; // após o prefixo

export interface CreateApplicationInput {
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  scopes?: string[];
  ipAllowlist?: string[];
  rateLimitPerMinute?: number;
  contactEmail?: string;
}

export interface IssuedApiKey {
  id: string;
  prefix: string;        // ex: "kairos_a3f1b2c4d5e6"
  secret: string;        // RETORNADO APENAS 1 VEZ
  secretLastFour: string;
  expiresAt: Date | null;
}

export interface CreateApplicationResult {
  application: {
    id: string;
    name: string;
    slug: string;
    tenantId: string;
    scopes: string[];
    status: string;
  };
  apiKey: IssuedApiKey;
}

/**
 * Cria nova Application + primeira ApiKey.
 * Retorna o secret em claro — caller DEVE armazenar/entregar com cuidado.
 */
export async function createApplication(
  input: CreateApplicationInput,
  actorUserId: string,
): Promise<CreateApplicationResult> {
  // Valida tenant existe e não está bloqueado
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, status: true },
  });
  if (!tenant) throw AppError.notFound('Tenant');
  if (tenant.status === 'BLOCKED') {
    throw AppError.forbidden('Tenant bloqueado');
  }

  // Slug único global
  const existing = await prisma.application.findUnique({ where: { slug: input.slug } });
  if (existing) throw AppError.conflict('Slug já em uso');

  // Gera secret + prefix
  const secret = randomBytes(32).toString('base64url'); // 256 bits
  const keyId = randomBytes(KEY_ID_LENGTH / 2).toString('hex'); // 12 chars hex
  const prefix = `${PREFIX_NAMESPACE}_${keyId}`;
  const secretLastFour = secret.slice(-4);

  // Encrypt at rest
  const secretEncrypted = encrypt(secret);

  // Hash pra lookup/identificação
  const secretHash = createHash('sha256').update(secret).digest('hex');

  // Cria Application + primeira ApiKey em transação
  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        scopes: input.scopes ?? [],
        ipAllowlist: input.ipAllowlist ?? [],
        rateLimitPerMinute: input.rateLimitPerMinute ?? 600,
        contactEmail: input.contactEmail,
      },
    });

    const apiKey = await tx.apiKey.create({
      data: {
        applicationId: application.id,
        prefix,
        secretHash,
        secretEncrypted,
        secretLastFour,
      },
    });

    // Audit log
    await tx.applicationAuditLog.create({
      data: {
        applicationId: application.id,
        action: 'application.created',
        metadata: { actorUserId, scopes: input.scopes ?? [] },
      },
    });

    return { application, apiKey };
  });

  return {
    application: {
      id: result.application.id,
      name: result.application.name,
      slug: result.application.slug,
      tenantId: result.application.tenantId,
      scopes: result.application.scopes,
      status: result.application.status,
    },
    apiKey: {
      id: result.apiKey.id,
      prefix: result.apiKey.prefix,
      secret, // ÚNICA VEZ QUE O SECRET É RETORNADO
      secretLastFour: result.apiKey.secretLastFour,
      expiresAt: result.apiKey.expiresAt,
    },
  };
}

/**
 * Lista applications (com métricas) — usado pelo painel super admin.
 */
export async function listApplications(query: {
  tenantId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, slug: true, name: true, status: true } },
        _count: { select: { apiKeys: true, webhooks: true, authTokens: true } },
      },
    }),
    prisma.application.count({ where }),
  ]);

  // NÃO retorna secretEncrypted, secretHash
  const safeItems = items.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    description: a.description,
    tenantId: a.tenantId,
    tenant: a.tenant,
    scopes: a.scopes,
    status: a.status,
    ipAllowlist: a.ipAllowlist,
    rateLimitPerMinute: a.rateLimitPerMinute,
    contactEmail: a.contactEmail,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    revokedAt: a.revokedAt,
    metrics: a._count,
  }));

  return {
    data: safeItems,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getApplication(id: string) {
  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, slug: true, name: true, status: true } },
      apiKeys: {
        select: {
          id: true, prefix: true, secretLastFour: true,
          scopes: true, expiresAt: true, lastUsedAt: true,
          createdAt: true, revokedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      webhooks: {
        select: {
          id: true, url: true, events: true, active: true,
          createdAt: true, secretLastFour: true,
        },
      },
    },
  });
  if (!app) throw AppError.notFound('Aplicação');
  return app;
}

/**
 * Revoga uma Application. Não deleta (LGPD/auditoria).
 */
export async function revokeApplication(
  id: string,
  reason: string,
  actorUserId: string,
) {
  const app = await prisma.application.findUnique({ where: { id } });
  if (!app) throw AppError.notFound('Aplicação');
  if (app.revokedAt) return app; // idempotente

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    // Revoga todas as AuthTokens da app
    await tx.authToken.updateMany({
      where: { applicationId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Revoga todas as ApiKeys
    await tx.apiKey.updateMany({
      where: { applicationId: id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'application_revoked' },
    });

    await tx.applicationAuditLog.create({
      data: {
        applicationId: id,
        action: 'application.revoked',
        metadata: { actorUserId, reason },
      },
    });

    return updated;
  });

  return result;
}

/**
 * Gera nova ApiKey pra uma Application existente.
 * Retorna secret em claro 1x só.
 */
export async function createApiKey(
  applicationId: string,
  options: { scopes?: string[]; description?: string; expiresAt?: Date } = {},
  actorUserId: string,
): Promise<IssuedApiKey> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, revokedAt: true, scopes: true },
  });
  if (!app) throw AppError.notFound('Aplicação');
  if (app.status !== 'ACTIVE' || app.revokedAt) {
    throw AppError.forbidden('Aplicação não está ativa');
  }

  const secret = randomBytes(32).toString('base64url');
  const keyId = randomBytes(KEY_ID_LENGTH / 2).toString('hex');
  const prefix = `${PREFIX_NAMESPACE}_${keyId}`;
  const secretLastFour = secret.slice(-4);
  const secretEncrypted = encrypt(secret);
  const secretHash = createHash('sha256').update(secret).digest('hex');

  const apiKey = await prisma.$transaction(async (tx) => {
    const created = await tx.apiKey.create({
      data: {
        applicationId,
        prefix,
        secretHash,
        secretEncrypted,
        secretLastFour,
        scopes: options.scopes ?? [],
        description: options.description,
        expiresAt: options.expiresAt,
      },
    });
    await tx.applicationAuditLog.create({
      data: {
        applicationId,
        action: 'api_key.created',
        metadata: { actorUserId, prefix, scopes: options.scopes ?? [] },
      },
    });
    return created;
  });

  return {
    id: apiKey.id,
    prefix: apiKey.prefix,
    secret, // ÚNICA VEZ
    secretLastFour: apiKey.secretLastFour,
    expiresAt: apiKey.expiresAt,
  };
}

/**
 * Revoga uma ApiKey.
 */
export async function revokeApiKey(apiKeyId: string, reason: string, actorUserId: string) {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    include: { application: { select: { id: true } } },
  });
  if (!apiKey) throw AppError.notFound('ApiKey');
  if (apiKey.revokedAt) return apiKey;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    // Revoga todos os tokens derivados
    await tx.authToken.updateMany({
      where: { apiKeyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.applicationAuditLog.create({
      data: {
        applicationId: apiKey.application.id,
        action: 'api_key.revoked',
        metadata: { actorUserId, prefix: apiKey.prefix, reason },
      },
    });
    return updated;
  });

  return result;
}