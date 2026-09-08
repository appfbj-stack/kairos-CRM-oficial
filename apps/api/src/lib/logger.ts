import type { FastifyLoggerOptions } from 'fastify';
import pino from 'pino';
import { env } from '../config/env';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
];

const baseOptions = {
  level: env.LOG_LEVEL,
  base: { service: 'kairos-crm-api' },
  redact: { paths: redactPaths, censor: '***' },
};

/**
 * Para uso DIRETO com pino (em scripts, helpers).
 */
export const logger =
  env.NODE_ENV === 'development'
    ? pino({
        ...baseOptions,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      })
    : pino(baseOptions);

/**
 * Para passar pro Fastify v5 (que exige config object, não instance).
 */
export function buildLoggerOptions(): FastifyLoggerOptions | boolean {
  if (env.NODE_ENV === 'development') {
    return {
      level: env.LOG_LEVEL,
      base: { service: 'kairos-crm-api' },
      redact: { paths: redactPaths, censor: '***' },
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    } as any;
  }
  return {
    level: env.LOG_LEVEL,
    base: { service: 'kairos-crm-api' },
    redact: { paths: redactPaths, censor: '***' },
  } as any;
}
