import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import { env } from './config/env';
import { prisma } from '@kairos-crm/database';
import { buildLoggerOptions, logger } from './lib/logger';
import { authRoutes } from './modules/auth/auth.routes';
import { tenantRoutes } from './modules/tenants/tenants.routes';
import { userRoutes } from './modules/users/users.routes';
import { healthRoutes } from './modules/health/health.routes';
import { contactRoutes } from './modules/crm/contacts/contacts.routes';
import { leadRoutes } from './modules/crm/leads/leads.routes';
import { pipelineRoutes } from './modules/crm/pipelines/pipelines.routes';
import { taskRoutes } from './modules/crm/tasks/tasks.routes';
import { productRoutes } from './modules/crm/products/products.routes';
import { serviceRoutes } from './modules/crm/services/services.routes';
import { whatsappRoutes } from './modules/whatsapp/whatsapp.routes';
import { hermesRoutes } from './modules/hermes/hermes.routes';
import { superAdminRoutes } from './modules/superadmin/superadmin.routes';
import { notificationRoutes } from './modules/notifications/notifications.routes';
import { knowledgeRoutes } from './modules/knowledge/knowledge.routes';
import { automationsRoutes } from './modules/automations/automations.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';

async function buildServer() {
  const app = Fastify({
    logger: buildLoggerOptions(),
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // CORS
  await app.register(cors, {
    origin: env.WEB_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Helmet (segurança de headers)
  await app.register(helmet, { contentSecurityPolicy: false });

  // Erros sensíveis do @fastify/sensible
  await app.register(sensible);

  // Tolerar body vazio com Content-Type: application/json
  // (cliente antigo mandava POST sem body mas com header)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done((err as Error), undefined);
    }
  });

  // Health
  await app.register(healthRoutes);
  // Aliases de health (pro frontend conseguir bater via /api/health)
  app.get('/api/health', async () => ({ status: 'ok', service: 'kairos-crm-api', timestamp: new Date().toISOString() }));
  app.get('/api/health/db', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch (err) {
      return reply.status(503).send({ status: 'degraded', database: 'error', error: (err as Error).message });
    }
  });

  // /api/auth
  await app.register(authRoutes, { prefix: '/api/auth' });

  // /api/tenants
  await app.register(tenantRoutes, { prefix: '/api/tenants' });

  // /api/users
  await app.register(userRoutes, { prefix: '/api/users' });

  // /api/crm/contacts
  await app.register(contactRoutes, { prefix: '/api/crm/contacts' });

  // /api/crm/leads
  await app.register(leadRoutes, { prefix: '/api/crm/leads' });

  // /api/crm/pipelines
  await app.register(pipelineRoutes, { prefix: '/api/crm/pipelines' });

  // /api/crm/tasks
  await app.register(taskRoutes, { prefix: '/api/crm/tasks' });

  // /api/crm/products
  await app.register(productRoutes, { prefix: '/api/crm/products' });

  // /api/crm/services
  await app.register(serviceRoutes, { prefix: '/api/crm/services' });

  // /api/whatsapp/* + /api/inbox/* + webhook (rotas registradas no próprio module)
  await whatsappRoutes(app);

  // /api/hermes/* (Kairos IA — config, test, chat, logs)
  await hermesRoutes(app);

  // /api/knowledge/* (base de conhecimento por tenant)
  await knowledgeRoutes(app);

  // /api/automations/* + /api/followups/* + /api/appointments/*
  await automationsRoutes(app);

  // /api/audit (audit log do tenant)
  await auditRoutes(app);

  // /api/dashboard (KPIs para o dashboard)
  await dashboardRoutes(app);

  // /api/superadmin/* (painel operacional LGPD-compliant)
  await superAdminRoutes(app);

  // /api/notifications (sino + lista)
  await notificationRoutes(app);

  // 404
  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `Rota ${req.method} ${req.url} não encontrada` },
    });
  });

  return app;
}

async function start() {
  try {
    const app = await buildServer();
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    logger.info({ port: env.API_PORT, env: env.NODE_ENV }, '🚀 Kairos CRM API rodando');

    // Scheduler simples: processa follow-ups a cada 60s
    const { processScheduledFollowUps } = await import('./modules/automations/automations.service');
    setInterval(() => {
      processScheduledFollowUps().catch((err) =>
        logger.warn({ err: err.message }, 'scheduler follow-ups falhou'),
      );
    }, 60_000);
    logger.info('📅 Scheduler de follow-ups iniciado (60s)');
  } catch (err) {
    logger.error({ err }, '❌ Falha ao iniciar servidor');
    process.exit(1);
  }
}

start();
