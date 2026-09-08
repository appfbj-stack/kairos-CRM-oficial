import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';
import type { CreateKnowledgeInput, UpdateKnowledgeInput } from './knowledge.schema';

export async function list(actor: AuthenticatedUser, query: { search?: string; category?: string; active?: boolean; page: number; limit: number }) {
  if (!actor.tenantId) throw AppError.forbidden();
  const where: any = { tenantId: actor.tenantId };
  if (query.active !== undefined) where.active = query.active;
  if (query.category) where.category = query.category;
  if (query.search) where.OR = [
    { question: { contains: query.search, mode: 'insensitive' } },
    { answer: { contains: query.search, mode: 'insensitive' } },
  ];

  const [items, total] = await Promise.all([
    prisma.companyKnowledge.findMany({
      where, orderBy: { updatedAt: 'desc' },
      skip: (query.page - 1) * query.limit, take: query.limit,
    }),
    prisma.companyKnowledge.count({ where }),
  ]);
  return { data: items, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function get(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const k = await prisma.companyKnowledge.findFirst({ where: { id } });
  if (!k) throw AppError.notFound('Entrada');
  if (k.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return k;
}

export async function create(actor: AuthenticatedUser, input: CreateKnowledgeInput) {
  if (!actor.tenantId) throw AppError.forbidden('Super admin não cria direto');
  return prisma.companyKnowledge.create({
    data: {
      tenantId: actor.tenantId,
      question: input.question,
      answer: input.answer,
      category: input.category,
      source: input.source || 'manual',
      active: input.active,
    },
  });
}

export async function update(actor: AuthenticatedUser, id: string, input: UpdateKnowledgeInput) {
  if (!actor.tenantId) throw AppError.forbidden();
  const k = await prisma.companyKnowledge.findFirst({ where: { id } });
  if (!k) throw AppError.notFound('Entrada');
  if (k.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return prisma.companyKnowledge.update({ where: { id }, data: input });
}

export async function remove(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const k = await prisma.companyKnowledge.findFirst({ where: { id } });
  if (!k) throw AppError.notFound('Entrada');
  if (k.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  await prisma.companyKnowledge.delete({ where: { id } });
}

/** Busca full-text simples (ILIKE) — usado pela Kairos IA. */
export async function search(actor: AuthenticatedUser, query: string, limit: number) {
  if (!actor.tenantId) throw AppError.forbidden();
  const items = await prisma.companyKnowledge.findMany({
    where: {
      tenantId: actor.tenantId,
      active: true,
      OR: [
        { question: { contains: query, mode: 'insensitive' } },
        { answer: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  });
  return items;
}
