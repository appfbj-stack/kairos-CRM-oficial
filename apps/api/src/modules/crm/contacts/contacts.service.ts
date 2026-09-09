import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import type { CreateContactInput, UpdateContactInput } from './contacts.schema';

export async function listContacts(actor: AuthenticatedUser, query: { search?: string; tag?: string; page: number; limit: number }) {
  if (!actor.tenantId) throw AppError.forbidden();

  const where: any = { tenantId: actor.tenantId, deletedAt: null };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.tag) where.tags = { has: query.tag };

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { leads: true, conversations: true } },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return {
    data: items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getContact(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const c = await prisma.contact.findFirst({
    where: { id, deletedAt: null },
    include: {
      company: true,
      leads: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { stage: { select: { id: true, name: true, color: true } } },
      },
      _count: { select: { leads: true, conversations: true, appointments: true } },
    },
  });
  if (!c) throw AppError.notFound('Contato');
  if (c.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return c;
}

export async function createContact(actor: AuthenticatedUser, input: CreateContactInput) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não cria contato direto');

  // Verifica duplicata por telefone (único por tenant)
  if (input.phone) {
    const existing = await prisma.contact.findFirst({
      where: { tenantId: actor.tenantId, phone: input.phone, deletedAt: null },
    });
    if (existing) {
      throw AppError.conflict('Já existe um contato com este telefone neste tenant');
    }
  }

  return prisma.contact.create({
    data: {
      tenantId: actor.tenantId,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      companyId: input.companyId,
      tags: input.tags,
      notes: input.notes,
      source: input.source,
    },
  });
}

export async function updateContact(actor: AuthenticatedUser, id: string, input: UpdateContactInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  const c = await prisma.contact.findFirst({ where: { id, deletedAt: null } });
  if (!c) throw AppError.notFound('Contato');
  if (c.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  return prisma.contact.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.email !== undefined && { email: input.email || null }),
      ...(input.companyId !== undefined && { companyId: input.companyId }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.source !== undefined && { source: input.source }),
    },
  });
}

export async function deleteContact(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const c = await prisma.contact.findFirst({ where: { id, deletedAt: null } });
  if (!c) throw AppError.notFound('Contato');
  if (c.tenantId !== actor.tenantId) throw AppError.tenantMismatch();

  await prisma.contact.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
