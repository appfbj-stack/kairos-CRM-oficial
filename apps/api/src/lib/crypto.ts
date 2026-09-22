/**
 * Crypto helpers — encryption at rest para ApiKey secrets.
 *
 * Algoritmo: AES-256-GCM (autenticado).
 * - Key: 32 bytes derivada da env KAIROS_API_MASTER_KEY (base64url ou base64)
 * - IV: 12 bytes random por encrypt
 * - Auth tag: 16 bytes
 *
 * Formato do ciphertext (string base64url):
 *   `<iv_b64url>.<tag_b64url>.<ciphertext_b64url>`
 *
 * Por que GCM e não CBC:
 *   - Autenticação integrada (detecta tampering do ciphertext)
 *   - Sem padding oracle
 *   - Suportado nativamente no Node crypto (sem libs externas)
 *
 * Nota de segurança:
 *   - Master key NUNCA deve ir pra DB. Só env ou KMS.
 *   - Se master key vazar, TODOS os ApiKey secrets ficam comprometidos
 *     (rotação master + re-encrypt tudo é mandatória).
 *   - Logar master key é crime. Não fazer.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../config/env';

const ALG = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * Resolve a master key uma vez no boot. Valida tamanho.
 * Lança erro fatal se a env não estiver setada corretamente.
 */
function getMasterKey(): Buffer {
  const raw = env.KAIROS_API_MASTER_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      'KAIROS_API_MASTER_KEY não setada ou muito curta (mínimo 32 chars base64 → 24 bytes)',
    );
  }
  // Aceita base64url ou base64 — converter pra Buffer
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== KEY_LEN) {
    throw new Error(
      `KAIROS_API_MASTER_KEY inválida: esperado ${KEY_LEN} bytes após decode base64, veio ${key.length}`,
    );
  }
  return key;
}

// Resolve uma vez (cache em módulo)
let cachedKey: Buffer | null = null;
function masterKey(): Buffer {
  if (!cachedKey) cachedKey = getMasterKey();
  return cachedKey;
}

/**
 * Encripta um plaintext. Retorna string no formato `iv.tag.ciphertext` (base64url).
 */
export function encrypt(plaintext: string): string {
  const key = masterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    ct.toString('base64url'),
  ].join('.');
}

/**
 * Decripta um ciphertext no formato `iv.tag.ciphertext`.
 * Lança erro se formato inválido OU se auth tag falhar (tampering).
 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split('.');
  if (parts.length !== 3) {
    throw new Error('Ciphertext malformado (esperado iv.tag.ciphertext)');
  }
  const [ivB64, tagB64, ctB64] = parts;

  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const ct = Buffer.from(ctB64, 'base64url');

  if (iv.length !== IV_LEN) throw new Error(`IV inválido (esperado ${IV_LEN} bytes)`);
  if (tag.length !== TAG_LEN) throw new Error(`Auth tag inválida (esperado ${TAG_LEN} bytes)`);

  const decipher = createDecipheriv(ALG, masterKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/**
 * Helper pra gerar uma nova master key (uso em setup/admin UI).
 * Output: 32 bytes em base64url (43 chars).
 */
export function generateMasterKey(): string {
  return randomBytes(KEY_LEN).toString('base64url');
}

/**
 * Helper de teste — limpa o cache da master key.
 * NÃO usar em produção.
 */
export function _resetMasterKeyCache(): void {
  cachedKey = null;
}