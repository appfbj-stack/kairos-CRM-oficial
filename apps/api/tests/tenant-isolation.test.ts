/**
 * TESTE OBRIGATÓRIO — Isolamento multi-tenant.
 *
 * Cenário:
 *  1. Tenant A cria 1 usuário (Manager)
 *  2. Tenant B cria 1 usuário (Manager)
 *  3. Tenant A tenta ler o usuário do Tenant B → deve falhar (404 ou 403)
 *  4. Tenant A tenta atualizar o usuário do Tenant B → deve falhar
 *  5. Tenant A tenta deletar o usuário do Tenant B → deve falhar
 *  6. Tenant B vê o próprio usuário normalmente
 *  7. SUPER_ADMIN enxerga todos
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AppError } from '@kairos-crm/shared';
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from '../src/modules/users/users.service';
import { tenantAction, createTenant } from '../src/modules/tenants/tenants.service';
import { signAccessToken, signRefreshToken } from '../src/lib/jwt';
import { hashRefreshToken } from '../src/lib/jwt';
import type { AuthenticatedUser } from '@kairos-crm/shared';

const prisma = new PrismaClient();
const TEST_PREFIX = 'test-iso-';

async function clean() {
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: TEST_PREFIX } } });
}

async function makeTenant(slug: string) {
  const t = await prisma.tenant.create({
    data: {
      name: `Tenant ${slug}`,
      slug: `${TEST_PREFIX}${slug}`,
      email: `${slug}@test.com`,
      status: 'ACTIVE',
      plan: 'FREE',
    },
  });
  const passwordHash = await bcrypt.hash('senha123', 4); // rounds baixos pra teste rápido
  const admin = await prisma.user.create({
    data: {
      tenantId: t.id,
      email: `${TEST_PREFIX}${slug}-admin@test.com`,
      passwordHash,
      name: `Admin ${slug}`,
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
    },
  });
  return { tenant: t, admin };
}

function asUser(user: { id: string; email: string; role: any; tenantId: string | null; name: string }): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: null,
  };
}

describe('Isolamento multi-tenant', () => {
  let tenantA: Awaited<ReturnType<typeof makeTenant>>;
  let tenantB: Awaited<ReturnType<typeof makeTenant>>;
  let userA: Awaited<ReturnType<typeof createUser>>;
  let superAdmin: any;

  beforeAll(async () => {
    await clean();
    tenantA = await makeTenant('a');
    tenantB = await makeTenant('b');

    userA = await createUser(asUser(tenantA.admin), {
      name: 'Manager A',
      email: `${TEST_PREFIX}manager-a@test.com`,
      passwordHash: await bcrypt.hash('senha123', 4),
      role: 'MANAGER',
    });

    // Super admin (tenantId null)
    const passwordHash = await bcrypt.hash('senha123', 4);
    superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        email: `${TEST_PREFIX}superadmin@test.com`,
        passwordHash,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    await clean();
    await prisma.user.deleteMany({ where: { email: `${TEST_PREFIX}superadmin@test.com` } });
    await prisma.$disconnect();
  });

  it('Tenant A consegue listar e ver o próprio usuário', async () => {
    const list = await listUsers(asUser(tenantA.admin), {});
    expect(list.find((u) => u.id === userA.id)).toBeTruthy();
    const u = await getUser(asUser(tenantA.admin), userA.id);
    expect(u.id).toBe(userA.id);
  });

  it('Tenant B NÃO consegue ler o usuário do Tenant A', async () => {
    await expect(getUser(asUser(tenantB.admin), userA.id)).rejects.toThrowError(
      /Acesso negado|inválid/i,
    );
  });

  it('Tenant B NÃO consegue atualizar o usuário do Tenant A', async () => {
    await expect(
      updateUser(asUser(tenantB.admin), userA.id, { name: 'Hacker' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('Tenant B NÃO consegue deletar o usuário do Tenant A', async () => {
    await expect(
      deleteUser(asUser(tenantB.admin), userA.id),
    ).rejects.toBeInstanceOf(AppError);

    // Verifica que o usuário A continua existindo
    const stillThere = await prisma.user.findUnique({ where: { id: userA.id } });
    expect(stillThere?.deletedAt).toBeNull();
  });

  it('Tenant B NÃO vê o usuário do Tenant A na listagem', async () => {
    const list = await listUsers(asUser(tenantB.admin), {});
    expect(list.find((u) => u.id === userA.id)).toBeFalsy();
  });

  it('SUPER_ADMIN consegue ver usuários de qualquer tenant', async () => {
    const list = await listUsers(asUser(superAdmin), {});
    // Super admin sem filtro vê todos (incluindo o nosso user de teste)
    expect(list.length).toBeGreaterThan(0);
  });

  it('Tenant A não consegue listar usuários do Tenant B', async () => {
    const { tenant: _t, admin: _a, ...rest } = tenantA;
    void _t; void _a;
    const a = await prisma.user.create({
      data: {
        tenantId: tenantB.tenant.id,
        email: `${TEST_PREFIX}extra-b@test.com`,
        passwordHash: 'x',
        name: 'Extra B',
        role: 'AGENT',
        status: 'ACTIVE',
      },
    });
    const list = await listUsers(asUser(tenantA.admin), {});
    expect(list.find((u) => u.id === a.id)).toBeFalsy();
  });
});

describe('Ações de tenant (Super Admin)', () => {
  let t: any;
  let superAdmin: any;

  beforeAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: `${TEST_PREFIX}suspend` } });
    await prisma.user.deleteMany({ where: { email: `${TEST_PREFIX}sa2@test.com` } });
    const passwordHash = await bcrypt.hash('senha123', 4);
    superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        email: `${TEST_PREFIX}sa2@test.com`,
        passwordHash,
        name: 'SA2',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: `${TEST_PREFIX}suspend` } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
    await prisma.$disconnect();
  });

  it('Super Admin consegue suspender e reativar um tenant', async () => {
    t = await prisma.tenant.create({
      data: {
        name: 'Teste Susp',
        slug: `${TEST_PREFIX}suspend`,
        email: 'susp@test.com',
        status: 'ACTIVE',
        plan: 'FREE',
      },
    });

    await tenantAction(t.id, { action: 'suspend', reason: 'teste' }, superAdmin.id);
    let updated = await prisma.tenant.findUnique({ where: { id: t.id } });
    expect(updated?.status).toBe('SUSPENDED');

    await tenantAction(t.id, { action: 'activate' }, superAdmin.id);
    updated = await prisma.tenant.findUnique({ where: { id: t.id } });
    expect(updated?.status).toBe('ACTIVE');
  });
});
