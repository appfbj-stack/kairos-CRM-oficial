/**
 * Assinatura de webhooks outbound (CRM → apps externos).
 *
 * Mesmo formato do HMAC de auth:
 *   Header: X-Kairos-Signature: t=<unix>,v1=<hex-hmac-sha256>
 *
 * String a assinar: `${t}.${rawBody}` (timestamp + "." + body)
 *
 * Receiver (apps) valida com a mesma função `verify` de lib/hmac.ts,
 * usando o secret que receberam quando criaram o WebhookEndpoint.
 *
 * Tolerância de timestamp: ±300s (anti-replay)
 */

import { createHmac, createHash, randomBytes } from 'crypto';
import { verify as verifyHmac, sign as signHmac } from './hmac';

const SECRET_PREFIX = 'whsec_';

/**
 * Gera um secret novo (256 bits, base64url, prefixado `whsec_`).
 * Equivalente Stripe-style pra clareza visual.
 */
export function generateWebhookSecret(): string {
  return SECRET_PREFIX + randomBytes(32).toString('base64url');
}

/**
 * Hash do secret pra persistir (não usar pra verificação).
 */
export function hashWebhookSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/**
 * Extrai os últimos 4 chars do secret (sem o prefixo whsec_).
 */
export function webhookSecretLastFour(secret: string): string {
  return secret.slice(-4);
}

/**
 * Assina um payload pra enviar.
 * Retorna header value `t=<ts>,v1=<hex>`.
 */
export function signWebhookPayload(secret: string, body: string, timestamp?: number): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  return signHmac({ secret, timestamp: ts, body });
}

/**
 * Verifica assinatura recebida de um webhook.
 * Helper que encapsula a função genérica de hmac.ts.
 */
export function verifyWebhookPayload(
  secret: string,
  signature: string,
  body: string,
  options?: { toleranceSeconds?: number },
): { valid: boolean; reason?: string; timestamp?: number } {
  return verifyHmac({
    secret,
    signature,
    body,
    windowSeconds: options?.toleranceSeconds,
  });
}

/**
 * Helper pra construir o ID de delivery (pra dedup no receptor).
 * Formato: `evt_<unix>_<random>` — único o suficiente pra webhook delivery.
 */
export function generateDeliveryId(): string {
  return `evt_${Math.floor(Date.now() / 1000)}_${randomBytes(8).toString('hex')}`;
}