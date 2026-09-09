/**
 * Seed adicional — Fase 2: pipelines padrão + leads de exemplo
 * Idempotente.
 */
import { PrismaClient, LeadTemperature, LeadStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed Fase 2: pipelines + leads...');

  const tenants = await prisma.tenant.findMany({ where: { deletedAt: null } });

  for (const tenant of tenants) {
    // Pipeline padrão (se não existir)
    let pipeline = await prisma.pipeline.findFirst({ where: { tenantId: tenant.id, isDefault: true } });
    if (!pipeline) {
      pipeline = await prisma.pipeline.create({
        data: {
          tenantId: tenant.id,
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
        include: { stages: { orderBy: { position: 'asc' } } },
      });
      console.log(`✅ Pipeline criado: ${tenant.slug}`);
    }

    // Alguns contatos de exemplo (só pros tenants que não têm)
    const existingContacts = await prisma.contact.count({ where: { tenantId: tenant.id } });
    if (existingContacts === 0) {
      const samples = tenant.slug === 'salao-beleza'
        ? [
            { name: 'Maria Silva', phone: '11999990001', email: 'maria@example.com', tags: ['cliente-vip', 'corte-feminino'] },
            { name: 'João Santos', phone: '11999990002', email: 'joao@example.com', tags: ['novo'] },
            { name: 'Ana Costa', phone: '11999990003', email: 'ana@example.com', tags: ['coloração'] },
            { name: 'Pedro Oliveira', phone: '11999990004', email: '', tags: ['novo'] },
            { name: 'Carla Mendes', phone: '11999990005', email: 'carla@example.com', tags: ['manicure'] },
          ]
        : tenant.slug === 'solar-energia'
        ? [
            { name: 'Roberto Lima', phone: '11988880001', email: 'roberto@example.com', tags: ['residencial'] },
            { name: 'Fernanda Alves', phone: '11988880002', email: 'fernanda@example.com', tags: ['comercial'] },
            { name: 'Marcos Pereira', phone: '11988880003', email: '', tags: ['residencial', 'alto-consumo'] },
            { name: 'Juliana Rocha', phone: '11988880004', email: 'ju@example.com', tags: ['indústria'] },
          ]
        : [];

      const createdContacts = [];
      for (const s of samples) {
        const c = await prisma.contact.create({
          data: {
            tenantId: tenant.id,
            name: s.name,
            phone: s.phone,
            email: s.email || null,
            tags: s.tags,
            source: 'manual',
          },
        });
        createdContacts.push(c);
      }

      // Cria leads de exemplo (1 por stage)
      const stages = await prisma.pipelineStage.findMany({
        where: { pipelineId: pipeline.id },
        orderBy: { position: 'asc' },
      });
      const wonStage = stages.find(s => s.isWon)!;
      const lostStage = stages.find(s => s.isLost)!;
      const normalStages = stages.filter(s => !s.isWon && !s.isLost);

      const leadSamples: Array<{ contactIdx: number; stage: typeof stages[0]; temperature: LeadTemperature; status: LeadStatus; title: string; value: number; intention: string; interest: string }> = [
        { contactIdx: 0, stage: wonStage, temperature: 'HOT', status: 'WON', title: 'Corte + escova progressiva', value: 28000, intention: 'agendar', interest: 'progressiva' },
        { contactIdx: 1, stage: normalStages[0], temperature: 'WARM', status: 'OPEN', title: 'Corte masculino', value: 5000, intention: 'agendar', interest: 'corte' },
        { contactIdx: 2, stage: normalStages[1], temperature: 'HOT', status: 'OPEN', title: 'Coloração + corte', value: 15000, intention: 'comprar', interest: 'coloração' },
        { contactIdx: 3, stage: normalStages[2], temperature: 'WARM', status: 'OPEN', title: 'Orçamento progressiva', value: 12000, intention: 'orçamento', interest: 'progressiva' },
        { contactIdx: 4, stage: normalStages[3], temperature: 'COLD', status: 'OPEN', title: 'Manicure mensal', value: 8000, intention: 'agendar', interest: 'manicure' },
      ];

      // Ajusta títulos pro solar
      if (tenant.slug === 'solar-energia') {
        leadSamples[0].title = 'Sistema Solar 5kWp residencial';
        leadSamples[0].value = 3500000;
        leadSamples[0].interest = 'solar-residencial';
        leadSamples[1].title = 'Consulta tamanho do sistema';
        leadSamples[1].value = 0;
        leadSamples[1].interest = 'solar-residencial';
        leadSamples[2].title = 'Sistema 10kWp comercial';
        leadSamples[2].value = 7500000;
        leadSamples[2].interest = 'solar-comercial';
        leadSamples[3].title = 'Orçamento usina solar';
        leadSamples[3].value = 15000000;
        leadSamples[3].interest = 'solar-industrial';
        leadSamples[4].title = 'Manutenção preventiva';
        leadSamples[4].value = 80000;
        leadSamples[4].interest = 'manutenção';
      }

      for (const ls of leadSamples) {
        const contact = createdContacts[ls.contactIdx];
        if (!contact) continue;
        await prisma.lead.create({
          data: {
            tenantId: tenant.id,
            contactId: contact.id,
            pipelineId: pipeline.id,
            stageId: ls.stage.id,
            title: ls.title,
            valueCents: ls.value,
            temperature: ls.temperature,
            status: ls.status,
            intention: ls.intention,
            interest: ls.interest,
            origin: 'site',
            aiHandled: false,
            wonAt: ls.status === 'WON' ? new Date() : null,
          },
        });
      }
      console.log(`✅ ${samples.length} contatos + ${leadSamples.length} leads criados: ${tenant.slug}`);
    }
  }

  console.log('\n🎉 Seed Fase 2 concluído!');
}

main()
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
