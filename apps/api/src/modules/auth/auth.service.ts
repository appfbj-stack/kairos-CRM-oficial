import { prisma } from '@kairos-crm/database';
import { AppError, type LoginInput, type RegisterInput } from '@kairos-crm/shared';
import { hashPassword, verifyPassword } from '../../lib/password';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../lib/jwt';
import { env } from '../../config/env';

const REFRESH_TTL_DAYS = 7;

export async function register(input: RegisterInput) {
  // Valida unicidade
  const existingTenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
  if (existingTenant) {
    throw AppError.conflict('Slug já está em uso');
  }

  // Cria tenant + admin em transação
  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.tenantName,
        slug: input.tenantSlug,
        email: input.tenantEmail,
        phone: input.tenantPhone,
        status: 'TRIAL',
        plan: 'FREE',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    const admin = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: input.email,
        passwordHash,
        name: input.name,
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: admin.id,
        action: 'tenant.created',
        resource: 'tenant',
        resourceId: tenant.id,
        metadata: { source: 'self-registration' },
      },
    });

    return { tenant, admin };
  });

  return issueTokens(result.admin.id);
}

export async function login(input: LoginInput) {
  let user;

  if (input.tenantSlug) {
    // Caminho explícito: tenant + email
    const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
    if (!tenant) throw AppError.unauthenticated('Credenciais inválidas');
    user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
    });
  } else {
    // Tenta como super admin (tenantId null)
    user = await prisma.user.findFirst({
      where: { email: input.email, tenantId: null },
    });

    if (!user) {
      // Senão, tenta achar em qualquer tenant (1 só resultado)
      const matches = await prisma.user.findMany({
        where: { email: input.email, tenantId: { not: null } },
        include: { tenant: { select: { slug: true, status: true } } },
      });
      if (matches.length === 1) {
        const match = matches[0];
        if (match.tenant?.status === 'BLOCKED') {
          throw AppError.forbidden('Tenant bloqueado');
        }
        user = match;
      } else if (matches.length > 1) {
        throw AppError.conflict('Email existe em múltiplos tenants. Informe o slug.');
      }
    }
  }

  if (!user) throw AppError.unauthenticated('Credenciais inválidas');
  if (user.status !== 'ACTIVE') throw AppError.forbidden('Usuário inativo');
  if (user.deletedAt) throw AppError.unauthenticated('Credenciais inválidas');

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw AppError.unauthenticated('Credenciais inválidas');

  // Atualiza lastLogin
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return issueTokens(user.id);
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthenticated('Refresh token inválido ou expirado');
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw AppError.unauthenticated('Refresh token revogado ou expirado');
  }

  const user = await prisma.user.findFirst({ where: { id: payload.sub, deletedAt: null } });
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.unauthenticated('Usuário inválido');
  }

  // Rotação: revoga o atual e emite novo
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(user.id);
}

export async function logout(refreshToken: string) {
  if (!refreshToken) return;
  const tokenHash = hashRefreshToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { tenant: { select: { id: true, slug: true, name: true, status: true } } },
  });
  if (!user) throw AppError.unauthenticated();

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: user.tenant?.slug ?? null,
    tenantName: user.tenant?.name ?? null,
  };
}

// =====================================================
// Helpers
// =====================================================

async function issueTokens(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role as any,
  });

  const { token: refreshToken, hash, jti } = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
  );

  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      tokenHash: hash,
      expiresAt,
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: null,
    },
    accessToken,
    refreshToken,
    expiresIn: parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN) / 1000,
  };
}

function parseDurationToMs(d: string): number {
  const match = d.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, n, unit] = match;
  const num = parseInt(n, 10);
  switch (unit) {
    case 'ms': return num;
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}
