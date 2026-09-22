/**
 * HMAC signing/verification + token opaco (client-side).
 *
 * Replica o que o servidor faz em apps/api/src/lib/hmac.ts.
 * Mantido simples — Node 20+ com Web Crypto API (zero deps).
 */

/**
 * Assina payload com HMAC-SHA256.
 * Header value: "t=<unix>,v1=<hex>"
 */
export async function sign(secret: string, timestamp: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const data = new TextEncoder().encode(`${timestamp}.${body}`);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  const hex = bufferToHex(new Uint8Array(sig));
  return `t=${timestamp},v1=${hex}`;
}

/**
 * Verifica assinatura recebida.
 * Tolerância: ±300s (anti-replay).
 */
export async function verify(
  secret: string,
  signature: string,
  body: string,
  options: { toleranceSeconds?: number; now?: number } = {},
): Promise<{ valid: boolean; reason?: string }> {
  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.now ?? Math.floor(Date.now() / 1000);

  // Parse "t=...,v1=..."
  const match = signature.match(/^t=(\d+),v1=([a-f0-9]{64})$/i);
  if (!match) return { valid: false, reason: 'malformed' };

  const timestamp = parseInt(match[1], 10);
  const v1 = match[2].toLowerCase();

  if (Math.abs(now - timestamp) > tolerance) {
    return { valid: false, reason: 'expired' };
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const data = new TextEncoder().encode(`${timestamp}.${body}`);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  const expected = bufferToHex(new Uint8Array(sig));

  // Constant-time compare
  if (expected.length !== v1.length) return { valid: false, reason: 'mismatch' };
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0 ? { valid: true } : { valid: false, reason: 'mismatch' };
}

function bufferToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Gera um secret novo (256 bits em base64url).
 * Use pra criar WebhookEndpoints via SDK.
 */
export function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'whsec_' + bufferToBase64url(bytes);
}

function bufferToBase64url(buf: Uint8Array): string {
  // btoa disponível no Node 20+
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
