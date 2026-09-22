/**
 * HMAC SHA-256 signing/verification para apps externos.
 *
 * Formato do header de assinatura:
 *   X-Kairos-Signature: t=<unix-seconds>,v1=<hex-hmac-sha256>
 *
 * String a assinar:
 *   `${t}.${rawBody}`  (timestamp + "." + body exato recebido)
 *
 * Proteções:
 *   - constant-time compare (evita timing attack)
 *   - timestamp window: ±300s (anti-replay)
 *   - formato de header validado
 *
 * Usado em DOIS lugares:
 *   1. Inbound (apps → CRM): valida POST /auth/token
 *   2. Outbound (CRM → apps webhook): assinatura idêntica no header
 */

import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_WINDOW_SECONDS = 300; // ±5min

export interface SignParams {
  secret: string;
  timestamp: number; // unix seconds
  body: string;      // raw body (string exata)
}

export function sign({ secret, timestamp, body }: SignParams): string {
  const t = Math.floor(timestamp);
  const data = `${t}.${body}`;
  const hex = createHmac('sha256', secret).update(data).digest('hex');
  return `t=${t},v1=${hex}`;
}

export interface VerifyParams {
  secret: string;
  signature: string;       // header value: "t=...,v1=..."
  body: string;            // raw body
  now?: number;            // unix seconds (default Date.now()/1000)
  windowSeconds?: number;  // default 300
}

export interface VerifyResult {
  valid: boolean;
  reason?: 'malformed' | 'expired' | 'future' | 'mismatch';
  timestamp?: number;
}

/**
 * Verifica assinatura com proteção contra timing attack.
 * Retorna { valid: true } ou { valid: false, reason }.
 * Erros de parse são tratados como inválidos (não throw).
 */
export function verify(params: VerifyParams): VerifyResult {
  const now = Math.floor(params.now ?? Date.now() / 1000);
  const window = params.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  // Parse "t=...,v1=..."
  const parsed = parseSignature(params.signature);
  if (!parsed) return { valid: false, reason: 'malformed' };

  // Window check
  const delta = now - parsed.timestamp;
  if (delta > window) return { valid: false, reason: 'expired', timestamp: parsed.timestamp };
  if (delta < -window) return { valid: false, reason: 'future', timestamp: parsed.timestamp };

  // Re-compute HMAC
  const expected = createHmac('sha256', params.secret)
    .update(`${parsed.timestamp}.${params.body}`)
    .digest('hex');

  // Constant-time compare
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(parsed.signature, 'utf8');
  if (a.length !== b.length) return { valid: false, reason: 'mismatch' };

  const equal = timingSafeEqual(a, b);
  return equal
    ? { valid: true, timestamp: parsed.timestamp }
    : { valid: false, reason: 'mismatch' };
}

function parseSignature(header: string): { timestamp: number; signature: string } | null {
  if (typeof header !== 'string') return null;
  const parts = header.split(',').map((s) => s.trim());
  let timestamp: number | null = null;
  let signature: string | null = null;
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const key = p.slice(0, eq).trim();
    const val = p.slice(eq + 1).trim();
    if (key === 't') {
      const n = Number(val);
      if (!Number.isFinite(n) || n <= 0) return null;
      timestamp = n;
    } else if (key === 'v1') {
      if (!/^[a-f0-9]{64}$/i.test(val)) return null;
      signature = val.toLowerCase();
    }
  }
  if (timestamp === null || signature === null) return null;
  return { timestamp, signature };
}

/**
 * Helper pra gerar secrets — usado em seed e admin UI.
 * 32 bytes = 256 bits, base64url.
 */
export function generateSecret(): string {
  return require('crypto').randomBytes(32).toString('base64url');
}

/**
 * Hash do secret (SHA-256). Pra lookup no banco.
 */
export function hashSecret(secret: string): string {
  return createHmac('sha256', '__hash__').update(secret).digest('hex');
  // Nota: HMAC com key fixa não é ideal pra password — pra ApiKey.secret
  // usaremos argon2 (lib externa) na Fase 3 quando o Pastor quiser.
  // Por enquanto SHA-256 já que o secret é high-entropy (256 bits).
}