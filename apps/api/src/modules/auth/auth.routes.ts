import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  AppError,
} from '@kairos-crm/shared';
import * as authService from './auth.service';
import { authenticate } from '../../middleware/auth';
import { injectTenantContext } from '../../middleware/tenant';
import { sendError } from '../../lib/errors';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register — cria tenant + admin
  app.post('/register', async (req, reply) => {
    try {
      const input = registerSchema.parse(req.body);
      const result = await authService.register(input);
      return reply.status(201).send(result);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // POST /api/auth/login — rate limit agressivo (5 tentativas / 15min por IP)
  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          ban: 3, // após 3 bloqueios, bane por 1h
        },
      },
    },
    async (req, reply) => {
      try {
        const input = loginSchema.parse(req.body);
        const result = await authService.login(input);
        return reply.send(result);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );

  // POST /api/auth/refresh
  app.post('/refresh', async (req, reply) => {
    try {
      const input = refreshSchema.parse(req.body);
      const result = await authService.refresh(input.refreshToken);
      return reply.send(result);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // POST /api/auth/logout
  app.post('/logout', async (req, reply) => {
    try {
      const body = z.object({ refreshToken: z.string() }).parse(req.body);
      await authService.logout(body.refreshToken);
      return reply.send({ ok: true });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  // GET /api/auth/me — info do usuário autenticado
  app.get(
    '/me',
    { preHandler: [authenticate, injectTenantContext] },
    async (req, reply) => {
      try {
        const user = (req as any).user;
        const result = await authService.me(user.id);
        return reply.send(result);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );
}
