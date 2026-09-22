/**
 * Testes unitários: External token (Fase 2).
 * Cobre: issue, hash determinístico, extractBearer, validateApiKeyPrefix.
 */

import { describe, it, expect } from 'vitest';
import { issueToken, hashToken, extractBearer, validateApiKeyPrefix, isExpired } from '../../src/lib/external-token';

describe('External token — issue/hash', () => {
  it('issueToken gera token de 256 bits (~43 chars base64url) + hash determinístico', () => {
    const issued = issueToken();
    expect(issued.token.length).toBeGreaterThanOrEqual(43);
    expect(issued.token.length).toBeLessThanOrEqual(50);
    expect(/^[A-Za-z0-9_-]+$/.test(issued.token)).toBe(true); // base64url
    expect(issued.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(issued.ttlSeconds).toBe(900); // 15min default
  });

  it('hashToken é determinístico (mesmo input → mesmo hash)', () => {
    const t = 'abc123_def456-ghi789';
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it('hashToken difere para tokens diferentes', () => {
    expect(hashToken('token-A')).not.toBe(hashToken('token-B'));
  });

  it('issueToken gera tokens únicos (sem colisão em 1000 gerações)', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(issueToken().token);
    }
    expect(tokens.size).toBe(1000);
  });

  it('ttl customizado é respeitado', () => {
    const issued = issueToken({ ttl: '5m' });
    expect(issued.ttlSeconds).toBe(300);
  });

  it('ttl inválido cai pro default de 7 dias', () => {
    const issued = issueToken({ ttl: 'invalid' });
    // parseDurationToMs retorna default 7d = 604800s
    expect(issued.ttlSeconds).toBe(604800);
  });
});

describe('External token — isExpired', () => {
  it('token expirado', () => {
    const past = new Date(Date.now() - 1000);
    expect(isExpired(past)).toBe(true);
  });

  it('token ainda válido', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isExpired(future)).toBe(false);
  });

  it('token expirando agora (boundary)', () => {
    const now = new Date();
    expect(isExpired(now)).toBe(true); // getTime() <= now.getTime()
  });
});

describe('External token — extractBearer', () => {
  it('extrai token de header válido', () => {
    const result = extractBearer('Bearer abc123_def456-ghi789_jkl012-mno345-pqr678');
    expect(result).toBe('abc123_def456-ghi789_jkl012-mno345-pqr678');
  });

  it('case-insensitive no prefixo "bearer"', () => {
    const result = extractBearer('BEARER abc123_def456-ghi789_jkl012-mno345-pqr678');
    expect(result).toBe('abc123_def456-ghi789_jkl012-mno345-pqr678');
  });

  it('ignora espaços extras', () => {
    const result = extractBearer('Bearer   abc123_def456-ghi789_jkl012-mno345-pqr678   ');
    expect(result).toBe('abc123_def456-ghi789_jkl012-mno345-pqr678');
  });

  it('retorna null se header ausente', () => {
    expect(extractBearer(undefined)).toBeNull();
  });

  it('retorna null se não começa com Bearer', () => {
    expect(extractBearer('Basic abc123_def456-ghi789_jkl012-mno345-pqr678')).toBeNull();
    expect(extractBearer('Token abc123_def456-ghi789_jkl012-mno345-pqr678')).toBeNull();
    expect(extractBearer('abc123_def456-ghi789_jkl012-mno345-pqr678')).toBeNull();
  });

  it('retorna null se token muito curto', () => {
    expect(extractBearer('Bearer short')).toBeNull();
    expect(extractBearer('Bearer ')).toBeNull();
  });

  it('retorna null se input não é string', () => {
    expect(extractBearer(undefined as any)).toBeNull();
    expect(extractBearer(null as any)).toBeNull();
    expect(extractBearer(123 as any)).toBeNull();
  });
});

describe('External token — validateApiKeyPrefix', () => {
  it('aceita prefixos válidos', () => {
    expect(validateApiKeyPrefix('kairos_abc12345')).toBe('kairos_abc12345');
    expect(validateApiKeyPrefix('KAIROS_ABC12345')).toBe('kairos_abc12345'); // lowercase
    expect(validateApiKeyPrefix('kairos_a3f1b2')).toBe('kairos_a3f1b2');
  });

  it('rejeita prefixos inválidos', () => {
    expect(validateApiKeyPrefix('abc12345')).toBeNull(); // sem prefixo kairos_
    expect(validateApiKeyPrefix('kairos_')).toBeNull(); // 7 chars total < 8
    expect(validateApiKeyPrefix('kairos_ABC!@#')).toBeNull(); // caracteres especiais
    expect(validateApiKeyPrefix('kairos_abc def')).toBeNull(); // espaço
    expect(validateApiKeyPrefix('kairos_' + 'x'.repeat(30))).toBeNull(); // > 32 chars total
    expect(validateApiKeyPrefix('')).toBeNull();
    expect(validateApiKeyPrefix(undefined as any)).toBeNull();
  });

  it('aceita prefixo exatamente 8 chars (limite inferior)', () => {
    expect(validateApiKeyPrefix('kairos_a')).toBe('kairos_a'); // 8 chars — mínimo
    expect(validateApiKeyPrefix('kairos_ab')).toBe('kairos_ab'); // 9 chars
  });
});