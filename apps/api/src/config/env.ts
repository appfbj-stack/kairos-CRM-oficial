import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_ROUNDS: z.coerce.number().default(12),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Evolution API (WhatsApp provider)
  EVOLUTION_BASE_URL: z.string().default('http://evogo-api:8080'),
  EVOLUTION_API_KEY: z.string().default('kairos-evolution-key'),
  EVOLUTION_WEBHOOK_URL: z.string().optional(),
  EVOLUTION_WEBHOOK_SECRET: z.string().optional(), // se setado, exige HMAC SHA256 no header

  // Fase 9 — API externa
  // Master key pra encryption at rest dos ApiKey secrets (AES-256-GCM)
  // DEVE ser 32 bytes em base64url (43 chars). Gere com: openssl rand -base64 32
  // Em produção: armazenar em secret manager (Vault/AWS Secrets Manager/etc)
  KAIROS_API_MASTER_KEY: z.string().min(32, 'KAIROS_API_MASTER_KEY deve ter no mínimo 32 chars (32 bytes base64 = 43 chars)').optional(),

  // TTL do auth token externo (default 15m, igual ao JWT humano)
  EXTERNAL_AUTH_TOKEN_TTL: z.string().default('15m'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
