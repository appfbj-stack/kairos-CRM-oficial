import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { injectTenantContext } from '../../middleware/tenant';
import { sendError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { prisma } from '@kairos-crm/database';
import { AppError } from '@kairos-crm/shared';
import { buildProvider } from './llm/factory';
import * as service from './hermes.service';

const aiConfigSchema = z.object({
  provider: z.enum(['OPENAI', 'GEMINI', 'CLAUDE', 'DEEPSEEK', 'GLM', 'OLLAMA', 'OPENROUTER']).default('OPENAI'),
  model: z.string().min(1).max(80).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional().nullable(),
  assistantName: z.string().min(1).max(60).optional(),
  personality: z.string().max(500).optional(),
  objectives: z.array(z.string().max(60)).max(20).optional(),
  transferToHumanOn: z.array(z.string().max(60)).max(20).optional(),
  businessHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    days: z.array(z.number().int().min(0).max(6)),
  }).optional().nullable(),
  systemPrompt: z.string().max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  enabled: z.boolean().optional(),
  autoReply: z.boolean().optional(),
  monthlyLimit: z.number().int().min(0).optional().nullable(),
});

const testSchema = z.object({
  message: z.string().min(1).max(1000),
});

export async function hermesRoutes(app: FastifyInstance) {
  // /api/hermes/* + /api/hermes/webhook ficam dentro de sub-app autenticado
  await app.register(async (sub) => {
    sub.addHook('preHandler', authenticate);
    sub.addHook('preHandler', injectTenantContext);

    sub.get('/api/hermes/config', async (req, reply) => {
      try {
        const user = (req as any).user;
        if (!user.tenantId) throw AppError.forbidden();
        const cfg = await service.getAIConfig(user.tenantId);
        // Esconde apiKey completo por segurança
        if (cfg?.apiKey) {
          const last4 = cfg.apiKey.slice(-4);
          return reply.send({ ...cfg, apiKey: cfg.apiKey ? `••••${last4}` : null, hasKey: !!cfg.apiKey });
        }
        return reply.send(cfg || { assistantName: 'Kairos IA', enabled: false });
      } catch (err) { return sendError(reply, err); }
    });

    sub.patch('/api/hermes/config', async (req, reply) => {
      try {
        const user = (req as any).user;
        if (!user.tenantId) throw AppError.forbidden('Super admin não configura IA por tenant');
        if (!['MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw AppError.forbidden();

        const data = aiConfigSchema.parse(req.body);
        // Se apiKey veio como "••••..." (placeholder), mantém o anterior
        let { apiKey, ...rest } = data;
        if (apiKey && apiKey.startsWith('••••')) apiKey = undefined;

        const updated = await service.upsertAIConfig(user.tenantId, { ...rest, ...(apiKey ? { apiKey } : {}) });
        return reply.send({ ...updated, apiKey: updated.apiKey ? `••••${updated.apiKey.slice(-4)}` : null });
      } catch (err) { return sendError(reply, err); }
    });

    sub.post('/api/hermes/test', async (req, reply) => {
      try {
        const user = (req as any).user;
        if (!user.tenantId) throw AppError.forbidden();
        const cfg = await service.getAIConfig(user.tenantId);
        if (!cfg?.apiKey) throw AppError.badRequest('Configure a apiKey do LLM primeiro');
        const provider = buildProvider({
          provider: cfg.provider, model: cfg.model, apiKey: cfg.apiKey,
          baseUrl: cfg.apiKey && (cfg as any).baseUrl,
        });
        const t = await provider.testConnection();
        return reply.send(t);
      } catch (err) { return sendError(reply, err); }
    });

    sub.post('/api/hermes/chat', async (req, reply) => {
      try {
        const user = (req as any).user;
        if (!user.tenantId) throw AppError.forbidden();
        const { message } = testSchema.parse(req.body);
        if (!user.tenantId) throw AppError.forbidden();
        const cfg = await service.getAIConfig(user.tenantId);
        if (!cfg?.apiKey) throw AppError.badRequest('Configure a IA primeiro em /hermes');
        const provider = buildProvider({ provider: cfg.provider, model: cfg.model, apiKey: cfg.apiKey });
        const res = await provider.chat({
          system: 'Você é Kairos IA, assistente de teste do Kairos CRM. Responda de forma curta e prestativa.',
          messages: [{ role: 'user', content: message }],
          temperature: cfg.temperature,
        });
        return reply.send(res);
      } catch (err) { return sendError(reply, err); }
    });

    sub.get('/api/hermes/logs', async (req, reply) => {
      try {
        const user = (req as any).user;
        if (!user.tenantId) throw AppError.forbidden();
        const logs = await prisma.aIMessage.findMany({
          where: { tenantId: user.tenantId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        return reply.send({ data: logs });
      } catch (err) { return sendError(reply, err); }
    });
  });
}
