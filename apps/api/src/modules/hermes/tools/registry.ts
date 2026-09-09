import { prisma } from '@kairos-crm/database';
import { AppError } from '@kairos-crm/shared';
import { evolution } from '../../../lib/evolution';
import type { KairosTool, ToolContext, ToolResult } from './types';

export type { KairosTool, ToolContext, ToolResult } from './types';

function err(e: unknown): ToolResult {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

const getContactTool: KairosTool = {
  name: 'get_contact',
  description: 'Busca um contato pelo telefone (somente dígitos, com DDI). Retorna dados básicos do contato.',
  definition: {
    type: 'function',
    function: {
      name: 'get_contact',
      description: 'Busca contato por telefone dentro do tenant atual.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Telefone com DDI, ex: 5511999999999' },
        },
        required: ['phone'],
      },
    },
  },
  async execute(ctx: ToolContext, args: { phone: string }) {
    try {
      if (!ctx.actor.tenantId) return { ok: false, error: 'Sem tenant' };
      const c = await prisma.contact.findFirst({
        where: { tenantId: ctx.actor.tenantId, phone: String(args.phone).replace(/\D/g, ''), deletedAt: null },
      });
      return { ok: true, result: c || null };
    } catch (e) { return err(e); }
  },
};

const updateContactTool: KairosTool = {
  name: 'update_contact',
  description: 'Atualiza tags e/ou notas de um contato existente.',
  definition: {
    type: 'function',
    function: {
      name: 'update_contact',
      description: 'Atualiza dados do contato atual da conversa (tags, notas).',
      parameters: {
        type: 'object',
        properties: {
          contactId: { type: 'string', description: 'ID do contato (opcional, usa ctx se vazio)' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags para adicionar' },
          notes: { type: 'string', description: 'Notas livres' },
        },
      },
    },
  },
  async execute(ctx: ToolContext, args: { contactId?: string; tags?: string[]; notes?: string }) {
    try {
      const id = args.contactId || ctx.contactId;
      if (!id) return { ok: false, error: 'contactId obrigatório' };
      const c = await prisma.contact.findFirst({ where: { id, deletedAt: null } });
      if (!c) return { ok: false, error: 'Contato não encontrado' };
      if (c.tenantId !== ctx.actor.tenantId) return { ok: false, error: 'Acesso negado a contato de outro tenant' };
      const data: any = {};
      if (args.tags) {
        const merged = Array.from(new Set([...(c.tags || []), ...args.tags]));
        data.tags = merged;
      }
      if (args.notes !== undefined) data.notes = args.notes;
      const updated = await prisma.contact.update({ where: { id }, data });
      return { ok: true, result: { id: updated.id, tags: updated.tags, notes: updated.notes } };
    } catch (e) { return err(e); }
  },
};

const getLeadTool: KairosTool = {
  name: 'get_lead',
  description: 'Busca o lead ativo do contato atual da conversa (se existir).',
  definition: {
    type: 'function',
    function: {
      name: 'get_lead',
      description: 'Retorna o lead aberto (status OPEN) do contato atual.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  async execute(ctx: ToolContext) {
    try {
      const contactId = ctx.contactId;
      if (!contactId) return { ok: true, result: null };
      const lead = await prisma.lead.findFirst({
        where: { contactId, status: 'OPEN', deletedAt: null },
        include: { stage: true, pipeline: { select: { id: true, name: true } } },
      });
      return { ok: true, result: lead || null };
    } catch (e) { return err(e); }
  },
};

const createLeadTool: KairosTool = {
  name: 'create_lead',
  description: 'Cria um lead para o contato atual da conversa. Use quando o contato demonstrar interesse mas ainda não tiver lead ativo.',
  definition: {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Cria um lead novo no pipeline padrão do tenant.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título do lead (curto, ex: "Interesse em corte feminino")' },
          valueCents: { type: 'number', description: 'Valor estimado em centavos (opcional)' },
          interest: { type: 'string', description: 'Interesse identificado (opcional)' },
          origin: { type: 'string', description: 'Origem: whatsapp, instagram, site, etc (opcional)' },
        },
        required: ['title'],
      },
    },
  },
  async execute(ctx: ToolContext, args: { title: string; valueCents?: number; interest?: string; origin?: string }) {
    try {
      if (!ctx.actor.tenantId) return { ok: false, error: 'Sem tenant' };
      if (!ctx.contactId) return { ok: false, error: 'Sem contato na conversa' };

      const pipeline = await prisma.pipeline.findFirst({
        where: { tenantId: ctx.actor.tenantId, isDefault: true },
        include: { stages: { orderBy: { position: 'asc' } } },
      });
      if (!pipeline || !pipeline.stages.length) {
        // Pega o primeiro pipeline que existir
        const any = await prisma.pipeline.findFirst({
          where: { tenantId: ctx.actor.tenantId },
          include: { stages: { orderBy: { position: 'asc' } } },
        });
        if (!any) return { ok: false, error: 'Tenant sem pipelines configurados' };
        return createLeadInPipeline(any, ctx, args);
      }
      return createLeadInPipeline(pipeline, ctx, args);
    } catch (e) { return err(e); }
  },
};

async function createLeadInPipeline(pipeline: any, ctx: ToolContext, args: any): Promise<ToolResult> {
  const firstStage = pipeline.stages[0];
  const lead = await prisma.lead.create({
    data: {
      tenantId: ctx.actor.tenantId!,
      contactId: ctx.contactId!,
      pipelineId: pipeline.id,
      stageId: firstStage.id,
      title: args.title,
      valueCents: args.valueCents,
      interest: args.interest,
      origin: args.origin || 'whatsapp',
      aiHandled: true,
    },
  });
  return { ok: true, result: { id: lead.id, title: lead.title, pipeline: pipeline.name, stage: firstStage.name } };
}

const moveLeadTool: KairosTool = {
  name: 'move_lead',
  description: 'Move um lead para outra etapa do funil. Use quando o lead progride (ex: "fechado", "perdido", "agendar visita").',
  definition: {
    type: 'function',
    function: {
      name: 'move_lead',
      description: 'Move o lead ativo do contato para uma nova etapa do mesmo pipeline.',
      parameters: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'ID do lead (opcional, usa ctx.leadId se vazio)' },
          stageName: { type: 'string', description: 'Nome da etapa de destino (ex: "Qualificado", "Ganho", "Perdido")' },
        },
        required: ['stageName'],
      },
    },
  },
  async execute(ctx: ToolContext, args: { leadId?: string; stageName: string }) {
    try {
      const id = args.leadId || ctx.leadId;
      if (!id) return { ok: false, error: 'Sem lead ativo' };
      const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
      if (!lead) return { ok: false, error: 'Lead não encontrado' };
      if (lead.tenantId !== ctx.actor.tenantId) return { ok: false, error: 'Acesso negado' };

      const stage = await prisma.pipelineStage.findFirst({
        where: { pipelineId: lead.pipelineId, name: { equals: args.stageName, mode: 'insensitive' } },
      });
      if (!stage) return { ok: false, error: `Etapa "${args.stageName}" não encontrada neste pipeline` };

      const data: any = { stageId: stage.id };
      if (stage.isWon) { data.status = 'WON'; data.wonAt = new Date(); }
      else if (stage.isLost) { data.status = 'LOST'; data.lostAt = new Date(); }
      else { data.status = 'OPEN'; data.wonAt = null; data.lostAt = null; }

      const updated = await prisma.lead.update({ where: { id }, data });
      return { ok: true, result: { id: updated.id, stage: stage.name, status: updated.status } };
    } catch (e) { return err(e); }
  },
};

const getProductsTool: KairosTool = {
  name: 'get_products',
  description: 'Lista produtos ativos do tenant. Use para responder perguntas sobre o catálogo.',
  definition: {
    type: 'function',
    function: {
      name: 'get_products',
      description: 'Lista até 20 produtos ativos.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Buscar por nome (opcional)' },
        },
      },
    },
  },
  async execute(ctx: ToolContext, args: { search?: string }) {
    try {
      if (!ctx.actor.tenantId) return { ok: false, error: 'Sem tenant' };
      const where: any = { tenantId: ctx.actor.tenantId, active: true, deletedAt: null };
      if (args.search) where.name = { contains: args.search, mode: 'insensitive' };
      const items = await prisma.product.findMany({ where, take: 20, orderBy: { name: 'asc' } });
      return { ok: true, result: items.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, category: p.category, description: p.description })) };
    } catch (e) { return err(e); }
  },
};

const getServicesTool: KairosTool = {
  name: 'get_services',
  description: 'Lista serviços ativos do tenant (com duração e preço).',
  definition: {
    type: 'function',
    function: {
      name: 'get_services',
      description: 'Lista até 20 serviços ativos.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Buscar por nome (opcional)' },
        },
      },
    },
  },
  async execute(ctx: ToolContext, args: { search?: string }) {
    try {
      if (!ctx.actor.tenantId) return { ok: false, error: 'Sem tenant' };
      const where: any = { tenantId: ctx.actor.tenantId, active: true, deletedAt: null };
      if (args.search) where.name = { contains: args.search, mode: 'insensitive' };
      const items = await prisma.service.findMany({ where, take: 20, orderBy: { name: 'asc' } });
      return { ok: true, result: items.map((s) => ({ id: s.id, name: s.name, priceCents: s.priceCents, durationMinutes: s.durationMinutes, description: s.description })) };
    } catch (e) { return err(e); }
  },
};

const searchKnowledgeTool: KairosTool = {
  name: 'search_knowledge',
  description: 'Busca na base de conhecimento do tenant (perguntas e respostas).',
  definition: {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Busca full-text em perguntas e respostas da base de conhecimento.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca' },
        },
        required: ['query'],
      },
    },
  },
  async execute(ctx: ToolContext, args: { query: string }) {
    try {
      if (!ctx.actor.tenantId) return { ok: false, error: 'Sem tenant' };
      const q = args.query;
      const items = await prisma.companyKnowledge.findMany({
        where: {
          tenantId: ctx.actor.tenantId,
          active: true,
          OR: [
            { question: { contains: q, mode: 'insensitive' } },
            { answer: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      });
      return { ok: true, result: items.map((i) => ({ question: i.question, answer: i.answer, category: i.category })) };
    } catch (e) { return err(e); }
  },
};

const createTaskTool: KairosTool = {
  name: 'create_task',
  description: 'Cria uma tarefa para um humano fazer (ligar, enviar proposta, etc).',
  definition: {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Cria tarefa atribuível.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
          dueDate: { type: 'string', description: 'ISO date (opcional)' },
        },
        required: ['title'],
      },
    },
  },
  async execute(ctx: ToolContext, args: { title: string; description?: string; priority?: any; dueDate?: string }) {
    try {
      if (!ctx.actor.tenantId) return { ok: false, error: 'Sem tenant' };
      const t = await prisma.task.create({
        data: {
          tenantId: ctx.actor.tenantId,
          title: args.title,
          description: args.description,
          priority: args.priority || 'MEDIUM',
          dueDate: args.dueDate ? new Date(args.dueDate) : null,
          contactId: ctx.contactId,
          leadId: ctx.leadId,
          conversationId: ctx.conversationId,
        },
      });
      return { ok: true, result: { id: t.id, title: t.title, priority: t.priority } };
    } catch (e) { return err(e); }
  },
};

const handoffToHumanTool: KairosTool = {
  name: 'handoff_to_human',
  description: 'Transfere a conversa para um humano. Use quando o cliente pedir, estiver insatisfeito, ou o caso for sensível.',
  definition: {
    type: 'function',
    function: {
      name: 'handoff_to_human',
      description: 'Pausa a IA e marca a conversa como WITH_HUMAN.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Motivo da transferência' },
        },
      },
    },
  },
  async execute(ctx: ToolContext, args: { reason: string }) {
    try {
      if (!ctx.conversationId) return { ok: false, error: 'Sem conversa' };
      await prisma.conversation.update({
        where: { id: ctx.conversationId },
        data: { status: 'WITH_HUMAN', aiPaused: true, aiPausedReason: args.reason || 'ai_handoff' },
      });
      return { ok: true, result: { handoff: true, reason: args.reason } };
    } catch (e) { return err(e); }
  },
};

const sendWhatsappMessageTool: KairosTool = {
  name: 'send_whatsapp_message',
  description: 'Envia uma mensagem de texto pelo WhatsApp para o contato atual da conversa. Use SEMPRE que quiser responder ao cliente — a resposta NÃO é automática, você precisa chamar esta tool.',
  definition: {
    type: 'function',
    function: {
      name: 'send_whatsapp_message',
      description: 'Envia mensagem de WhatsApp para o contato atual.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Texto da mensagem a enviar' },
        },
        required: ['text'],
      },
    },
  },
  async execute(ctx: ToolContext, args: { text: string }) {
    try {
      if (!ctx.conversationId) return { ok: false, error: 'Sem conversa' };
      const conv = await prisma.conversation.findFirst({
        where: { id: ctx.conversationId },
        include: { contact: true, whatsappAccount: true },
      });
      if (!conv) return { ok: false, error: 'Conversa não encontrada' };
      if (conv.tenantId !== ctx.actor.tenantId) return { ok: false, error: 'Acesso negado' };
      if (!conv.whatsappAccount?.apiKey) return { ok: false, error: 'Conta WhatsApp sem token' };
      if (conv.whatsappAccount.status !== 'CONNECTED') {
        return { ok: false, error: 'WhatsApp desconectado' };
      }
      const res = await evolution.sendText(conv.whatsappAccount.apiKey, conv.contact.phone!, args.text);
      const msg = await prisma.message.create({
        data: {
          tenantId: ctx.actor.tenantId!,
          conversationId: conv.id,
          senderType: 'AI',
          direction: 'OUTBOUND',
          type: 'TEXT',
          content: args.text,
          externalId: (res as any)?.data?.key?.id,
        },
      });
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: new Date(), lastMessagePreview: args.text.slice(0, 120) },
      });
      return { ok: true, result: { sent: true, messageId: msg.id } };
    } catch (e) { return err(e); }
  },
};

export const ALL_TOOLS: KairosTool[] = [
  getContactTool,
  updateContactTool,
  getLeadTool,
  createLeadTool,
  moveLeadTool,
  getProductsTool,
  getServicesTool,
  searchKnowledgeTool,
  createTaskTool,
  handoffToHumanTool,
  sendWhatsappMessageTool,
];

export function getTool(name: string): KairosTool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}
