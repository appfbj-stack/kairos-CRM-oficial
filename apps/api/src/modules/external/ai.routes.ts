/**
 * AI endpoints para API externa.
 *
 *   POST /api/v1/external/ai/analyze
 *     - Recebe mensagem + contexto mínimo
 *     - Tenta classificador determinístico (zero tokens)
 *     - Se não der, chama LLM com system prompt compacto
 *     - Devolve JSON estruturado com `suggested_actions`
 *     - BACKEND decide se executa (não a LLM)
 *
 *   POST /api/v1/external/ai/chat
 *     - Conversa agente com tools (create_lead, search_products, etc)
 *     - LLM pode chamar tools; backend executa e devolve resultado
 *     - Limite de iterações: 5
 *
 * Auth: authenticateExternal + scope `ai.analyze` ou `ai.chat`
 * Rate limit: por applicationId (default 60 req/min pra /ai/*)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '@kairos-crm/shared';
import { prisma } from '@kairos-crm/database';
import {
  authenticateExternal,
  requireExternalScope,
} from '../../middleware/external-auth';
import { rateLimit, rateLimitHeaders } from '../../lib/ratelimit';
import { sendError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import {
  classifyDeterministic,
  extractEntities,
  shouldCallLLM,
} from '../hermes/classify';
import { buildProvider } from '../hermes/llm/factory';
import { ALL_TOOLS } from '../hermes/tools/registry';
import type { LLMMessage } from '../hermes/llm/types';

const analyzeSchema = z.object({
  message: z.string().min(1).max(4000),
  context: z.object({
    contactId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    channel: z.enum(['whatsapp', 'email', 'chat', 'web']).default('whatsapp'),
    locale: z.string().default('pt-BR'),
  }).optional(),
});

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().min(1).max(8000),
  })).min(1).max(50),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(50).max(4000).optional(),
});

const AI_RATE_LIMIT_PER_MIN = 60;

interface AnalyzeResponse {
  intent: string;
  category?: string;
  product_or_service?: string;
  vehicle?: { model?: string; year?: number };
  funnel_stage?: string;
  temperature?: 'cold' | 'warm' | 'hot';
  requires_human: boolean;
  extracted_entities: Record<string, any>;
  suggested_actions: Array<{ type: string; params: Record<string, any> }>;
  confidence: number;
  source: 'deterministic' | 'llm';
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export async function externalAIRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (sub) => {
    sub.addHook('preHandler', authenticateExternal);

    // ===== POST /ai/analyze =====
    sub.post(
      '/api/v1/external/ai/analyze',
      { preHandler: [requireExternalScope('ai.analyze')] },
      async (req, reply) => {
        try {
          const ctx = req.externalApp!;

          // Rate limit por applicationId
          const rl = await rateLimit({
            scope: 'ai_app',
            identifier: ctx.applicationId,
            limit: AI_RATE_LIMIT_PER_MIN,
            windowMs: 60_000,
          });
          reply.headers(rateLimitHeaders(rl));
          if (!rl.allowed) {
            throw AppError.rateLimited(
              `Limite ${AI_RATE_LIMIT_PER_MIN} req/min em /ai/* por app`,
            );
          }

          const input = analyzeSchema.parse(req.body);
          const decision = shouldCallLLM(input.message);

          // Caso 1: classificador determinístico resolveu
          if (decision.useDirect && decision.deterministic) {
            const entities = extractEntities(input.message);
            const response: AnalyzeResponse = {
              intent: decision.deterministic.intent,
              requires_human: decision.deterministic.intent === 'request_human',
              extracted_entities: entities as any,
              suggested_actions: deterministicActions(
                decision.deterministic.intent,
                entities,
                input.context,
              ),
              confidence: decision.deterministic.confidence,
              source: 'deterministic',
            };

            logger.info(
              {
                applicationId: ctx.applicationId,
                tenantId: ctx.tenantId,
                intent: response.intent,
                confidence: response.confidence,
              },
              'ai.analyze (deterministic)',
            );

            return reply.send(response);
          }

          // Caso 2: chamar LLM
          const cfg = await prisma.aIConfig.findUnique({
            where: { tenantId: ctx.tenantId },
          });
          if (!cfg || !cfg.enabled || !cfg.apiKey) {
            throw AppError.badRequest(
              'IA não configurada para este tenant — peça ao admin para ativar /hermes',
            );
          }

          const provider = buildProvider({
            provider: cfg.provider as any,
            model: cfg.model,
            apiKey: cfg.apiKey,
            baseUrl: (cfg as any).baseUrl,
          });

          const entities = extractEntities(input.message);
          const systemPrompt = buildAnalyzeSystemPrompt(input.context);
          const messages: LLMMessage[] = [
            { role: 'user', content: input.message },
          ];

          const res = await provider.chat({
            system: systemPrompt,
            messages,
            temperature: cfg.temperature ?? 0.3,
            maxTokens: 400,
          });

          // Parse do JSON de saída
          const parsed = safeParseJson(res.content || '');

          const response: AnalyzeResponse = {
            intent: parsed?.intent || 'unknown',
            category: parsed?.category,
            product_or_service: parsed?.product_or_service,
            vehicle: parsed?.vehicle,
            funnel_stage: parsed?.funnel_stage,
            temperature: parsed?.temperature || 'cold',
            requires_human: !!parsed?.requires_human,
            extracted_entities: { ...entities, ...(parsed?.entities || {}) },
            suggested_actions: parsed?.suggested_actions || [],
            confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0.5,
            source: 'llm',
            model: cfg.model || cfg.provider,
            tokensIn: res.usage?.promptTokens,
            tokensOut: res.usage?.completionTokens,
          };

          logger.info(
            {
              applicationId: ctx.applicationId,
              tenantId: ctx.tenantId,
              intent: response.intent,
              confidence: response.confidence,
              tokensIn: response.tokensIn,
              tokensOut: response.tokensOut,
              model: response.model,
            },
            'ai.analyze (llm)',
          );

          return reply.send(response);
        } catch (err) {
          return sendError(reply, err);
        }
      },
    );

    // ===== POST /ai/chat =====
    sub.post(
      '/api/v1/external/ai/chat',
      { preHandler: [requireExternalScope('ai.chat')] },
      async (req, reply) => {
        try {
          const ctx = req.externalApp!;

          const rl = await rateLimit({
            scope: 'ai_app',
            identifier: ctx.applicationId,
            limit: AI_RATE_LIMIT_PER_MIN,
            windowMs: 60_000,
          });
          reply.headers(rateLimitHeaders(rl));
          if (!rl.allowed) {
            throw AppError.rateLimited(`Limite ${AI_RATE_LIMIT_PER_MIN} req/min em /ai/* por app`);
          }

          const input = chatSchema.parse(req.body);

          const cfg = await prisma.aIConfig.findUnique({
            where: { tenantId: ctx.tenantId },
          });
          if (!cfg || !cfg.enabled || !cfg.apiKey) {
            throw AppError.badRequest('IA não configurada para este tenant');
          }

          const provider = buildProvider({
            provider: cfg.provider as any,
            model: cfg.model,
            apiKey: cfg.apiKey,
            baseUrl: (cfg as any).baseUrl,
          });

          const systemPrompt = `Você é um assistente de IA conversando via ${ctx.applicationId}. Responda de forma útil e concisa.`;
          const messages: LLMMessage[] = input.messages.map((m) => ({
            role: m.role,
            content: m.content,
          }));

          const res = await provider.chat({
            system: systemPrompt,
            messages,
            temperature: input.temperature ?? cfg.temperature ?? 0.7,
            maxTokens: input.maxTokens ?? 800,
            tools: ALL_TOOLS.map((t) => t.definition),
          });

          return reply.send({
            content: res.content,
            toolCalls: res.toolCalls,
            usage: res.usage,
            model: cfg.model || cfg.provider,
          });
        } catch (err) {
          return sendError(reply, err);
        }
      },
    );
  });
}

// =====================================================
// Helpers
// =====================================================

function buildAnalyzeSystemPrompt(context?: { locale?: string; channel?: string }): string {
  return `Você é um classificador de mensagens. Analise a mensagem do cliente e retorne APENAS JSON válido com este formato:

{
  "intent": "orcamento|agendamento|reclamacao|compra|info|social|desconhecido",
  "category": "string curta (ex: freios, pintura, instalação)",
  "product_or_service": "string curta",
  "vehicle": { "model": "string", "year": 2020 },
  "funnel_stage": "orcamento|qualificado|won|lost|info",
  "temperature": "cold|warm|hot",
  "requires_human": false,
  "entities": { "phone": "...", "year": 2020, "value_brl": 350.00 },
  "suggested_actions": [
    { "type": "upsert_contact", "params": { "phone": "5515..." } },
    { "type": "create_lead", "params": { "title": "...", "valueCents": 35000 } },
    { "type": "search_products", "params": { "query": "pastilha" } }
  ],
  "confidence": 0.85
}

Regras:
- Retorne SOMENTE o JSON (sem markdown, sem explicações)
- "requires_human": true se cliente pediu humano, reclamou, ou caso for sensível
- "suggested_actions": ações QUE O BACKEND PODE EXECUTAR (sugestões, não ordens)
- Locale: ${context?.locale ?? 'pt-BR'}
- Channel: ${context?.channel ?? 'whatsapp'}`.trim();
}

function deterministicActions(
  intent: string,
  entities: any,
  context?: { contactId?: string; leadId?: string; channel?: string },
): Array<{ type: string; params: Record<string, any> }> {
  const actions: Array<{ type: string; params: Record<string, any> }> = [];

  if (entities.phones?.length) {
    actions.push({
      type: 'upsert_contact',
      params: { phone: entities.phones[0] },
    });
  }

  switch (intent) {
    case 'orcamento':
      actions.push({
        type: 'search_products',
        params: entities.vehicleModel
          ? { query: `${entities.vehicleModel} ${entities.vehicleYear ?? ''}`.trim() }
          : {},
      });
      if (entities.currency) {
        actions.push({
          type: 'create_quote',
          params: {
            title: `Orçamento automático`,
            valueCents: Math.round(entities.currency.value * 100),
          },
        });
      }
      break;

    case 'agendamento':
      actions.push({
        type: 'check_availability',
        params: { channel: context?.channel ?? 'whatsapp' },
      });
      break;

    case 'reclamacao':
      actions.push({
        type: 'create_task',
        params: { title: 'Reclamação — atendimento humano', priority: 'URGENT' },
      });
      break;

    case 'request_human':
      actions.push({
        type: 'handoff_to_human',
        params: { reason: 'cliente solicitou' },
      });
      break;
  }

  return actions;
}

function safeParseJson(text: string): any {
  // Tenta extrair JSON mesmo se vier com ```json ... ``` ou texto extra
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}