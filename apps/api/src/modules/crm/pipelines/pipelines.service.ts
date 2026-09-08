import { prisma } from '@kairos-crm/database';
import { AppError, type AuthenticatedUser } from '@kairos-crm/shared';

export async function listPipelines(actor: AuthenticatedUser) {
  if (!actor.tenantId) throw AppError.forbidden();
  return prisma.pipeline.findMany({
    where: { tenantId: actor.tenantId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      stages: { orderBy: { position: 'asc' } },
      _count: { select: { leads: true } },
    },
  });
}

export async function getPipeline(actor: AuthenticatedUser, id: string) {
  if (!actor.tenantId) throw AppError.forbidden();
  const p = await prisma.pipeline.findFirst({
    where: { id, deletedAt: null },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
  if (!p) throw AppError.notFound('Pipeline');
  if (p.tenantId !== actor.tenantId) throw AppError.tenantMismatch();
  return p;
}

export async function createPipeline(actor: AuthenticatedUser, input: { name: string; isDefault?: boolean; stages: Array<{ name: string; color?: string; isWon?: boolean; isLost?: boolean }> }) {
  if (!actor.tenantId) throw AppError.forbidden();
  if (input.isDefault) {
    // Remove default dos outros
    await prisma.pipeline.updateMany({
      where: { tenantId: actor.tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.pipeline.create({
    data: {
      tenantId: actor.tenantId,
      name: input.name,
      isDefault: input.isDefault ?? false,
      stages: {
        create: input.stages.map((s, i) => ({
          name: s.name,
          position: i,
          color: s.color ?? '#10b981',
          isWon: s.isWon ?? false,
          isLost: s.isLost ?? false,
        })),
      },
    },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
}

export async function ensureDefaultPipeline(tenantId: string) {
  const existing = await prisma.pipeline.findFirst({
    where: { tenantId, isDefault: true },
  });
  if (existing) return existing;

  return prisma.pipeline.create({
    data: {
      tenantId,
      name: 'Funil de Vendas',
      isDefault: true,
      stages: {
        create: [
          { name: 'Novo', position: 0, color: '#64748b' },
          { name: 'Em Atendimento', position: 1, color: '#3b82f6' },
          { name: 'Qualificado', position: 2, color: '#8b5cf6' },
          { name: 'Orçamento', position: 3, color: '#f59e0b' },
          { name: 'Negociação', position: 4, color: '#ec4899' },
          { name: 'Ganho', position: 5, color: '#10b981', isWon: true },
          { name: 'Perdido', position: 6, color: '#ef4444', isLost: true },
        ],
      },
    },
  });
}
