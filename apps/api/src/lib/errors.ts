import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError, type ErrorResponse } from '@kairos-crm/shared';
import { logger } from './logger';

export function sendError(reply: FastifyReply, err: unknown) {
  if (err instanceof AppError) {
    return reply.status(err.statusCode).send({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    } satisfies ErrorResponse);
  }

  if (err instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: err.flatten(),
      },
    } satisfies ErrorResponse);
  }

  // Erro do Fastify (statusCode setado)
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const anyErr = err as { statusCode: number; message: string; code?: string };
    return reply.status(anyErr.statusCode).send({
      error: {
        code: (anyErr.code as any) || 'INTERNAL_ERROR',
        message: anyErr.message,
      },
    });
  }

  logger.error({ err }, 'Erro não tratado');
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Erro interno do servidor'
          : (err as Error)?.message || 'Erro desconhecido',
    },
  });
}
