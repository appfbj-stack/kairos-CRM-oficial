import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import type { CreateProductInput, UpdateProductInput } from './products.schema';

export async function listProducts(actor: AuthenticatedUser, query: { search?: string; category?: string; active?: boolean; page: number; limit: number }) {
  if (!actor.tenantId) throw AppError.forbidden();
  const where: any = { tenantId: actor.tenantId, deletedAt: null };
  if (query.active !== undefined) where.active = query.active;
  if (query.category) where.category = query.category;
  if (query.search) where.OR = [
    { name: { contains: query.search, mode: 'insensitive' } },
    { description: { contains: query.search, mode: 'insensitive' } },
  ];

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where, orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.limit, take: query.limit,
    }),
    prisma.product.count({ where }),
  ]);

  return { data: items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function getProduct(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const p = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!p) throw AppError.notFound('Produto');
  if (p.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return p;
}

export async function createProduct(actor: AuthenticatedUser, input: CreateProductInput) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não cria produto direto');
  const existing = await prisma.product.findFirst({
    where: { tenantId: actor.tenantId, name: input.name, deletedAt: null },
  });
  if (existing) throw AppError.conflict('Já existe um produto com este nome neste tenant');
  return prisma.product.create({
    data: {
      tenantId: actor.tenantId,
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      category: input.category,
      imageUrl: input.imageUrl,
      active: input.active,
    },
  });
}

export async function updateProduct(actor: AuthenticatedUser, id: string, input: UpdateProductInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  const p = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!p) throw AppError.notFound('Produto');
  if (p.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return prisma.product.update({ where: { id }, data: input });
}

export async function deleteProduct(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const p = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!p) throw AppError.notFound('Produto');
  if (p.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
}
