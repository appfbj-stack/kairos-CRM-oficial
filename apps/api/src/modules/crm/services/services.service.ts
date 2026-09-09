import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import type { CreateServiceInput, UpdateServiceInput } from './services.schema';

export async function listServices(actor: AuthenticatedUser, query: { search?: string; category?: string; active?: boolean; page: number; limit: number }) {
  if (!actor.tenantId) throw AppError.forbidden();
  const where: any = { tenantId: actor.tenantId, deletedAt: null };
  if (query.active !== undefined) where.active = query.active;
  if (query.category) where.category = query.category;
  if (query.search) where.OR = [
    { name: { contains: query.search, mode: 'insensitive' } },
    { description: { contains: query.search, mode: 'insensitive' } },
  ];

  const [items, total] = await Promise.all([
    prisma.service.findMany({
      where, orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.limit, take: query.limit,
      include: { _count: { select: { appointments: true } } },
    }),
    prisma.service.count({ where }),
  ]);

  return { data: items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function getService(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const s = await prisma.service.findFirst({
    where: { id, deletedAt: null },
    include: { appointments: { orderBy: { startTime: 'desc' }, take: 20 } },
  });
  if (!s) throw AppError.notFound('Serviço');
  if (s.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return s;
}

export async function createService(actor: AuthenticatedUser, input: CreateServiceInput) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não cria serviço direto');
  const existing = await prisma.service.findFirst({
    where: { tenantId: actor.tenantId, name: input.name, deletedAt: null },
  });
  if (existing) throw AppError.conflict('Já existe um serviço com este nome neste tenant');
  return prisma.service.create({
    data: {
      tenantId: actor.tenantId,
      name: input.name,
      description: input.description,
      durationMinutes: input.durationMinutes,
      priceCents: input.priceCents,
      category: input.category,
      active: input.active,
    },
  });
}

export async function updateService(actor: AuthenticatedUser, id: string, input: UpdateServiceInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  const s = await prisma.service.findFirst({ where: { id, deletedAt: null } });
  if (!s) throw AppError.notFound('Serviço');
  if (s.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return prisma.service.update({ where: { id }, data: input });
}

export async function deleteService(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const s = await prisma.service.findFirst({ where: { id, deletedAt: null } });
  if (!s) throw AppError.notFound('Serviço');
  if (s.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  await prisma.service.update({ where: { id }, data: { deletedAt: new Date() } });
}
