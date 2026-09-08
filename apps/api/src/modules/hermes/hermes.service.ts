import { prisma } from '@kairos-crm/database';
import type { AuthenticatedUser } from '@kairos-crm/shared';
import { logger } from '../../lib/logger';
import { buildProvider } from './llm/factory';
import { ALL_TOOLS, getTool, type ToolContext, type ToolResult } from './tools/registry';
import type { LLMMessage } from './llm/types';

const MAX_TOOL_ITERATIONS = 5;

export async function getAIConfig(tenantId: string) {
  return prisma.aIConfig.findUnique({ where: { tenantId } });
}

export async function upsertAIConfig(tenantId: string, data: any) {
  return prisma.aIConfig.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}

async function buildSystemPrompt(tenantId: string, contact: any, lead: any, products: any[], services: any[]): Promise<string> {
  const cfg = await prisma.aIConfig.findUnique({ where: { tenantId } });
  const name = cfg?.assistantName || 'Kairos IA';
  const personality = cfg?.personality || 'amigável, profissional e objetivo';
  const objectives = cfg?.objectives?.length
    ? cfg.objectives.join(', ')
    : 'atender, qualificar, agendar e responder dúvidas';
  const transferTriggers = cfg?.transferToHumanOn?.length
    ? cfg.transferToHumanOn.join(', ')
    : 'reclamação, pedido explícito de humano, pagamento';

  // Pega horário comercial
  const bh = (cfg?.businessHours as any) || null;
  const hoursLine = bh
    ? `Horário de atendimento: ${bh.start}–${bh.end} (${(bh.days || []).map((d: number) => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d]).join('/')})`
    : 'Atendimento 24h via IA; humano pode assumir a qualquer momento.';

  // Produtos/serviços resumidos
  const productList = products.slice(0, 10).map((p) => `- ${p.name}: R$ ${(p.priceCents / 100).toFixed(2)}${p.description ? ' — ' + p.description.slice(0, 60) : ''}`).join('\n');
  const serviceList = services.slice(0, 10).map((s) => `- ${s.name}: R$ ${(s.priceCents / 100).toFixed(2)} (${s.durationMinutes}min)${s.description ? ' — ' + s.description.slice(0, 60) : ''}`).join('\n');

  return `Você é ${name}, atendente virtual do negócio. Personalidade: ${personality}.

Seus objetivos: ${objectives}.

${hoursLine}

Regras:
- SEMPRE responda em português brasileiro.
- SEMPRE chame a tool send_whatsapp_message para enviar mensagens ao cliente (a resposta NÃO sai sozinha).
- Se o cliente pedir humano, reclamar, ou o caso for sensível (${transferTriggers}), chame handoff_to_human IMEDIATAMENTE.
- Quando o cliente demonstrar interesse em produto/serviço mas ainda não for lead, chame create_lead.
- Quando o lead progride de etapa, chame move_lead.
- Use create_task pra pedir ação humana (ligar, enviar proposta).
- Use search_knowledge pra responder dúvidas sobre o negócio.
- Seja conciso (máx ~3 linhas por mensagem WhatsApp). Use emojis com moderação.
- NUNCA invente preços ou disponibilidade. Use get_products / get_services / get_appointments.

${productList ? `Produtos do tenant:\n${productList}\n` : ''}${serviceList ? `Serviços do tenant:\n${serviceList}\n` : ''}Contato atual: ${contact?.name || 'desconhecido'}${contact?.phone ? ' (' + contact.phone + ')' : ''}.
${lead ? `Lead ativo: "${lead.title}" na etapa "${lead.stage?.name || '?'}" (status ${lead.status}).` : 'Sem lead ativo para este contato.'}`.trim();
}

export interface RunKairosParams {
  tenantId: string;
  userMessage: string;
  conversationId: string;
  contactId: string;
}

export async function runKairosIA(params: RunKairosParams): Promise<{ reply: string | null; toolCalls: number; handoff: boolean }> {
  const { tenantId, userMessage, conversationId, contactId } = params;

  const cfg = await prisma.aIConfig.findUnique({ where: { tenantId } });
  if (!cfg || !cfg.enabled) {
    logger.info({ tenantId }, 'Kairos IA desabilitada — pulando');
    return { reply: null, toolCalls: 0, handoff: false };
  }
  if (!cfg.apiKey) {
    logger.warn({ tenantId }, 'Kairos IA sem apiKey — pulando');
    return { reply: null, toolCalls: 0, handoff: false };
  }

  // Auto-pause check
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.aiPaused) {
    logger.info({ conversationId }, 'IA pausada ou conversa não encontrada — pulando');
    return { reply: null, toolCalls: 0, handoff: conv?.status === 'WITH_HUMAN' || false };
  }

  const provider = buildProvider({
    provider: cfg.provider,
    model: cfg.model,
    apiKey: cfg.apiKey,
  });

  // Carrega contexto
  const [contact, lead, products, services, history] = await Promise.all([
    prisma.contact.findFirst({ where: { id: contactId } }),
    prisma.lead.findFirst({ where: { contactId, status: 'OPEN', deletedAt: null }, include: { stage: true } }),
    prisma.product.findMany({ where: { tenantId, active: true, deletedAt: null }, take: 10 }),
    prisma.service.findMany({ where: { tenantId, active: true, deletedAt: null }, take: 10 }),
    prisma.message.findMany({
      where: { conversationId }, orderBy: { createdAt: 'asc' }, take: 20,
    }),
  ]);

  const system = await buildSystemPrompt(tenantId, contact, lead, products, services);

  // Monta histórico
  const messages: LLMMessage[] = history.map((m) => ({
    role: m.direction === 'INBOUND' ? 'user' : 'assistant',
    content: m.content || '',
    toolCalls: m.aiMetadata && (m.aiMetadata as any).toolCalls,
  }));

  // Override da última mensagem com a do user atual (pode vir do webhook)
  if (!messages.length || messages[messages.length - 1].content !== userMessage) {
    messages.push({ role: 'user', content: userMessage });
  }

  const tools = ALL_TOOLS.map((t) => t.definition);

  const toolContext: ToolContext = {
    actor: { id: '', email: 'kairos-ia@system', name: 'Kairos IA', role: 'USER', tenantId, tenantSlug: '', tenantName: '' } as AuthenticatedUser,
    conversationId,
    contactId,
    leadId: lead?.id,
  };

  let toolCallCount = 0;
  let handoff = false;
  let finalReply: string | null = null;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const response = await provider.chat({
      system,
      messages,
      tools,
      temperature: cfg.temperature,
    });

    if (response.content) finalReply = response.content;

    if (!response.toolCalls || response.toolCalls.length === 0) {
      break;
    }

    // Adiciona resposta do assistant com tool_calls
    messages.push({
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
    });

    // Executa cada tool call
    for (const tc of response.toolCalls) {
      const tool = getTool(tc.name);
      let result: ToolResult;
      if (!tool) {
        result = { ok: false, error: `Tool ${tc.name} não existe` };
      } else {
        try {
          result = await tool.execute(toolContext, tc.arguments);
        } catch (e) {
          result = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }
      toolCallCount++;
      if (tc.name === 'handoff_to_human' && result.ok) handoff = true;

      messages.push({
        role: 'tool',
        toolCallId: tc.id,
        name: tc.name,
        content: JSON.stringify(result),
      });
    }
  }

  // Log
  await prisma.aIMessage.create({
    data: {
      tenantId,
      configId: cfg.id,
      conversationId,
      userMessage,
      aiResponse: finalReply,
      toolCalls: toolCallCount ? { count: toolCallCount } : undefined,
      tokensIn: undefined,
      tokensOut: undefined,
    },
  }).catch((err) => logger.warn({ err: err.message }, 'falha ao salvar AIMessage'));

  // Atualiza monthlyUsed
  await prisma.aIConfig.update({
    where: { id: cfg.id },
    data: { monthlyUsed: { increment: 1 } },
  }).catch(() => {});

  return { reply: finalReply, toolCalls: toolCallCount, handoff };
}
