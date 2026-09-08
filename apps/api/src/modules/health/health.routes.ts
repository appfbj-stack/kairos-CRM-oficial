import type { FastifyInstance } from 'fastify';
import { prisma } from '@kairos-crm/database';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return { status: 'ok', service: 'kairos-crm-api', timestamp: new Date().toISOString() };
  });

  app.get('/health/db', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch (err) {
      return reply.status(503).send({ status: 'degraded', database: 'error', error: (err as Error).message });
    }
  });
}
