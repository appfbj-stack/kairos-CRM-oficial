/**
 * Health check público da API externa.
 * Sem auth — apps usam pra verificar disponibilidade antes de chamar /auth/token.
 */

import type { FastifyInstance } from 'fastify';

export async function externalHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/external/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      service: 'kairos-crm-api',
      api: 'v1/external',
      timestamp: new Date().toISOString(),
    });
  });
}