import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import type { CreateCompanyInput, UpdateCompanyInput } from './companies.schema';
import { emit } from '../../webhooks/dispatcher';

export async function listCompanies(actor: AuthenticatedUser, query: { search?: string; page: number; limit: number }) {
  if (!actor.tenantId) throw AppError.forbidden();

  const where: any = { tenantId: actor.tenantId, deletedAt: null };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { document: { contains: query.search, mode: 'insensitive' } },
      { industry: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { _count: { select: { contacts: true } } },
    }),
    prisma.company.count({ where }),
  ]);

  return {
    data: items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getCompany(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const c = await prisma.company.findFirst({
    where: { id, deletedAt: null },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, name: true, phone: true, email: true, createdAt: true },
      },
      _count: { select: { contacts: true } },
    },
  });
  if (!c) throw AppError.notFound('Empresa');
  if (c.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return c;
}

export async function createCompany(actor: AuthenticatedUser, input: CreateCompanyInput) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não cria empresa direto');

  // Verifica duplicata por nome (único por tenant)
  const existing = await prisma.company.findFirst({
    where: { tenantId: actor.tenantId, name: input.name, deletedAt: null },
  });
  if (existing) {
    throw AppError.conflict('Já existe uma empresa com este nome neste tenant');
  }

  const company = await prisma.company.create({
    data: {
      tenantId: actor.tenantId,
      name: input.name,
      document: input.document || null,
      industry: input.industry || null,
      size: input.size,
      website: input.website || null,
      notes: input.notes || null,
    },
  });

  emit('company.created', actor.tenantId, {
    id: company.id,
    name: company.name,
    document: company.document,
    industry: company.industry,
    website: company.website,
    createdAt: company.createdAt,
  }).catch(() => {});

  return company;
}

export async function updateCompany(actor: AuthenticatedUser, id: string, input: UpdateCompanyInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  const c = await prisma.company.findFirst({ where: { id, deletedAt: null } });
  if (!c) throw AppError.notFound('Empresa');
  if (c.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  return prisma.company.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.document !== undefined && { document: input.document || null }),
      ...(input.industry !== undefined && { industry: input.industry || null }),
      ...(input.size !== undefined && { size: input.size }),
      ...(input.website !== undefined && { website: input.website || null }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
    },
  });
}

export async function deleteCompany(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const c = await prisma.company.findFirst({ where: { id, deletedAt: null } });
  if (!c) throw AppError.notFound('Empresa');
  if (c.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  await prisma.company.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
