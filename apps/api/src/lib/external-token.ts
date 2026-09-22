/**
 * Tokens de autenticação para API externa.
 *
 * Opaco (NÃO JWT) — 256 bits random, base64url.
 * Hash SHA-256 guardado no banco (tabela AuthToken.tokenHash).
 *
 * Vantagens sobre JWT:
 *   - Revogação imediata (delete/update AuthToken.revokedAt)
 *   - Não vaza dados via payload
 *   - Sem problema de clock skew
 *   - Tabelas de auditoria indexáveis
 *
 * Fluxo:
 *   1. App envia POST /auth/token com API Key + HMAC
 *   2. Backend valida HMAC, gera token opaco, salva hash no DB
 *   3. Retorna { authToken, expiresIn, scopes }
 *   4. App usa: Authorization: Bearer <authToken>
 *   5. Middleware authenticateExternal busca hash no DB, valida expiração
 */

import { createHash, randomBytes } from 'crypto';
import { parseDurationToMs } from '@kairos-crm/shared';

const DEFAULT_TOKEN_TTL = '15m'; // idêntico ao JWT access

export interface IssueTokenParams {
  ttl?: string; // duration string, default '15m'
}

export interface IssuedToken {
  token: string;       // plaintext, devolvido ao client
  tokenHash: string;   // guardado no DB
  expiresAt: Date;
  ttlSeconds: number;
}

/**
 * Gera um novo token opaco + hash pra guardar no DB.
 */
export function issueToken(params: IssueTokenParams = {}): IssuedToken {
  const ttl = params.ttl ?? DEFAULT_TOKEN_TTL;
  const ttlMs = parseDurationToMs(ttl);
  const tokenBytes = randomBytes(32); // 256 bits
  const token = tokenBytes.toString('base64url');
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + ttlMs);
  return { token, tokenHash, expiresAt, ttlSeconds: Math.floor(ttlMs / 1000) };
}

/**
 * Re-deriva hash do token (lookup no DB).
 */
export function hashToken(token: string): string {
  return sha256(token);
}

/**
 * Verifica se um token ainda é válido (não expirado).
 */
export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/**
 * Extrai o token do header `Authorization: Bearer <token>`.
 * Returns null se formato inválido.
 */
export function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  if (!token || token.length < 32) return null; // tokens têm ~43 chars base64url
  return token;
}

/**
 * Valida formato do prefixo da ApiKey. Ex: "kairos_abc12345" (length 8-32).
 * Retorna null se inválido.
 */
export function validateApiKeyPrefix(prefix: string): string | null {
  if (!prefix || typeof prefix !== 'string') return null;
  if (prefix.length < 8 || prefix.length > 32) return null;
  if (!/^kairos_[a-z0-9]+$/i.test(prefix)) return null;
  return prefix.toLowerCase();
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}