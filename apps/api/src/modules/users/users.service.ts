import { prisma } from '@kairos-crm/database';
import { AppError, type CreateUserInput, type UpdateUserInput } from '@kairos-crm/shared';
import { hashPassword } from '../../lib/password';
import { assertSameTenant } from '../../middleware/tenant';
import type { AuthenticatedUser } from '@kairos-crm/shared';

export async function listUsers(actor: AuthenticatedUser, query: { search?: string; role?: string }) {
  if (!actor.tenantId && actor.role !== 'SUPER_ADMIN') {
    throw AppError.forbidden();
  }

  const where: any = {
    deletedAt: null,
  };

  if (actor.role === 'SUPER_ADMIN' && !query.role) {
    // Super admin pode ver todos se quiser
    // (mas por padrão, filtra pelo seu "scope")
  } else {
    where.tenantId = actor.tenantId;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.role) where.role = query.role;

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      phone: true,
      avatarUrl: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return users;
}

export async function getUser(actor: AuthenticatedUser, id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw AppError.notFound('Usuário');
  assertSameTenant(actor, user.tenantId);
  return user;
}

export async function createUser(
  actor: AuthenticatedUser,
  input: CreateUserInput,
) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não cria usuário direto via este endpoint');

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: actor.tenantId, email: input.email } },
  });
  if (existing) throw AppError.conflict('Email já está em uso neste tenant');

  // Validação: não criar SUPER_ADMIN via tenant
  if (input.role === 'SUPER_ADMIN') {
    throw AppError.forbidden('Não é possível criar SUPER_ADMIN via tenant');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      tenantId: actor.tenantId,
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role as any,
      phone: input.phone,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      phone: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'user.created',
      resource: 'user',
      resourceId: user.id,
      metadata: { email: user.email, role: user.role },
    },
  });

  return user;
}

export async function updateUser(
  actor: AuthenticatedUser,
  id: string,
  input: UpdateUserInput,
) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw AppError.notFound('Usuário');
  assertSameTenant(actor, user.tenantId);

  // Não pode promover a SUPER_ADMIN
  if (input.role === 'SUPER_ADMIN') {
    throw AppError.forbidden('Não é possível promover a SUPER_ADMIN');
  }

  // Não pode rebaixar o último TENANT_ADMIN
  if (input.role && user.role === 'TENANT_ADMIN' && input.role !== 'TENANT_ADMIN') {
    const adminCount = await prisma.user.count({
      where: { tenantId: actor.tenantId, role: 'TENANT_ADMIN', deletedAt: null },
    });
    if (adminCount <= 1) {
      throw AppError.conflict('Não é possível rebaixar o último TENANT_ADMIN');
    }
  }

  const data: any = { ...input };
  if (input.password) {
    data.passwordHash = await hashPassword(input.password);
    delete data.password;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      phone: true,
      updatedAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'user.updated',
      resource: 'user',
      resourceId: id,
      metadata: { changes: Object.keys(input) },
    },
  });

  return updated;
}

export async function deleteUser(actor: AuthenticatedUser, id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw AppError.notFound('Usuário');
  assertSameTenant(actor, user.tenantId);

  if (user.id === actor.id) {
    throw AppError.conflict('Você não pode deletar seu próprio usuário');
  }

  if (user.role === 'TENANT_ADMIN') {
    const adminCount = await prisma.user.count({
      where: { tenantId: actor.tenantId, role: 'TENANT_ADMIN', deletedAt: null },
    });
    if (adminCount <= 1) {
      throw AppError.conflict('Não é possível deletar o último TENANT_ADMIN');
    }
  }

  // Soft delete
  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'INACTIVE' },
  });

  // Revoga refresh tokens
  await prisma.refreshToken.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      userId: actor.id,
      action: 'user.deleted',
      resource: 'user',
      resourceId: id,
    },
  });
}
