/**
 * Seed inicial do Kairos CRM — Fase 1
 *
 * Cria:
 * - 1 Super Admin (global, sem tenant)
 * - 1 Tenant de demonstração
 * - 1 Tenant Admin para esse tenant
 * - 1 par de tenants (A e B) para teste de isolamento
 *
 * Idempotente: pode rodar várias vezes.
 */

import { PrismaClient, UserRole, TenantStatus, TenantPlan } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@kairoscrm.com';
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Troque@Senha123';
  const superAdminName = process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin Kairos';

  // ---- Super Admin ----
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  const superAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: null as any, // null é válido aqui (Prisma aceita)
        email: superAdminEmail,
      },
    },
    update: {},
    create: {
      tenantId: null,
      email: superAdminEmail,
      passwordHash,
      name: superAdminName,
      role: UserRole.SUPER_ADMIN,
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Super Admin: ${superAdmin.email} (id=${superAdmin.id})`);

  // ---- Tenant Demo ----
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Empresa Demonstração',
      slug: 'demo',
      email: 'contato@demo.com',
      phone: '11999990000',
      plan: TenantPlan.PRO,
      status: TenantStatus.ACTIVE,
    },
  });

  const demoAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'admin@demo.com',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: 'admin@demo.com',
      passwordHash,
      name: 'Admin Demo',
      role: UserRole.TENANT_ADMIN,
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Tenant Demo: ${demoTenant.slug} (id=${demoTenant.id})`);
  console.log(`✅ Admin Demo: ${demoAdmin.email}`);

  // ---- Tenants para teste de isolamento ----
  const tenantA = await prisma.tenant.upsert({
    where: { slug: 'tenant-a' },
    update: {},
    create: {
      name: 'Tenant A — Salão',
      slug: 'tenant-a',
      email: 'contato@tenanta.com',
      plan: TenantPlan.STARTER,
      status: TenantStatus.ACTIVE,
    },
  });

  const tenantB = await prisma.tenant.upsert({
    where: { slug: 'tenant-b' },
    update: {},
    create: {
      name: 'Tenant B — Energia Solar',
      slug: 'tenant-b',
      email: 'contato@tenantb.com',
      plan: TenantPlan.STARTER,
      status: TenantStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantA.id, email: 'admin@tenanta.com' } },
    update: {},
    create: {
      tenantId: tenantA.id,
      email: 'admin@tenanta.com',
      passwordHash,
      name: 'Admin Tenant A',
      role: UserRole.TENANT_ADMIN,
      status: 'ACTIVE',
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantB.id, email: 'admin@tenantb.com' } },
    update: {},
    create: {
      tenantId: tenantB.id,
      email: 'admin@tenantb.com',
      passwordHash,
      name: 'Admin Tenant B',
      role: UserRole.TENANT_ADMIN,
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Tenant A: ${tenantA.slug}`);
  console.log(`✅ Tenant B: ${tenantB.slug}`);

  console.log('\n🎉 Seed concluído!');
  console.log('\nCredenciais:');
  console.log(`  Super Admin:  ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`  Demo Admin:   admin@demo.com / ${superAdminPassword}`);
  console.log(`  Tenant A:     admin@tenanta.com / ${superAdminPassword}`);
  console.log(`  Tenant B:     admin@tenantb.com / ${superAdminPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
