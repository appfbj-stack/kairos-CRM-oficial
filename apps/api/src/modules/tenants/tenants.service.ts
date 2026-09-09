import { prisma } from '@kairos-crm/database';
import { AppError, type CreateTenantInput, type UpdateTenantInput, type TenantActionInput } from '@kairos-crm/shared';
import { hashPassword } from '../../lib/password';
import { emailSchema } from '@kairos-crm/shared';

export async function listTenants(query: { page?: number; limit?: number; status?: string; search?: string }) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = { deletedAt: null };
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true } } },
    }),
    prisma.tenant.count({ where }),
  ]);

  return {
    data: tenants,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getTenant(id: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { users: true } } },
  });
  if (!tenant) throw AppError.notFound('Tenant');
  return tenant;
}

export async function getTenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw AppError.notFound('Tenant');
  return tenant;
}

export async function createTenant(
  input: CreateTenantInput,
  actorUserId: string,
  actorIp?: string,
) {
  const existing = await prisma.tenant.findUnique({ where: { slug: input.slug } });
  if (existing) throw AppError.conflict('Slug já está em uso');

  // Email do admin (será gerado a partir do email do tenant se não vier)
  // Para simplificar, recebemos só o tenant aqui — admin é criado depois
  // em /api/admin/tenants/:id/users (Fase 2)
  const tenant = await prisma.tenant.create({
    data: {
      name: input.name,
      slug: input.slug,
      email: input.email,
      phone: input.phone,
      document: input.document,
      plan: input.plan as any,
      status: input.status as any,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: actorUserId,
      action: 'tenant.created',
      resource: 'tenant',
      resourceId: tenant.id,
      metadata: { source: 'super-admin' },
      ipAddress: actorIp,
    },
  });

  return tenant;
}

export async function updateTenant(id: string, input: UpdateTenantInput, actorUserId: string) {
  const tenant = await prisma.tenant.findFirst({ where: { id, deletedAt: null } });
  if (!tenant) throw AppError.notFound('Tenant');

  const updated = await prisma.tenant.update({
    where: { id },
    data: input as any,
  });

  await prisma.auditLog.create({
    data: {
      tenantId: id,
      userId: actorUserId,
      action: 'tenant.updated',
      resource: 'tenant',
      resourceId: id,
      metadata: { changes: input },
    },
  });

  return updated;
}

export async function tenantAction(
  id: string,
  input: TenantActionInput,
  actorUserId: string,
) {
  const tenant = await prisma.tenant.findFirst({ where: { id, deletedAt: null } });
  if (!tenant) throw AppError.notFound('Tenant');

  const statusMap: Record<string, any> = {
    activate: 'ACTIVE',
    suspend: 'SUSPENDED',
    block: 'BLOCKED',
    unblock: 'ACTIVE',
  } as const;

  const newStatus = statusMap[input.action];
  if (!newStatus) throw AppError.validation('Ação inválida');

  const updated = await prisma.tenant.update({
    where: { id },
    data: { status: newStatus },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: id,
      userId: actorUserId,
      action: `tenant.${input.action}`,
      resource: 'tenant',
      resourceId: id,
      metadata: { reason: input.reason },
    },
  });

  return updated;
}
