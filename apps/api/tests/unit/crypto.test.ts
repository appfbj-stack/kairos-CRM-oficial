/**
 * Testes unitários: Crypto AES-256-GCM (Fase 2 - encryption at rest).
 *
 * Cobre:
 *   - Round-trip (encrypt → decrypt = plaintext original)
 *   - IV random (mesmo plaintext → ciphertexts diferentes)
 *   - Tampering detection (modifica ciphertext → falha no decrypt)
 *   - Formato malformado (não começa com iv.tag.ct)
 *   - IV errado → falha
 *   - Auth tag inválida → falha
 *   - generateMasterKey gera 32 bytes em base64url
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, generateMasterKey } from '../../src/lib/crypto';

describe('Crypto AES-256-GCM — round-trip', () => {
  it('encrypt + decrypt retorna plaintext original', () => {
    const plaintext = 'minha-api-key-super-secreta-256-bits';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('funciona com strings vazias', () => {
    const ciphertext = encrypt('');
    expect(decrypt(ciphertext)).toBe('');
  });

  it('funciona com strings grandes (1MB)', () => {
    const plaintext = 'x'.repeat(1024 * 1024);
    const ciphertext = encrypt(plaintext);
    expect(ciphertext.length).toBeGreaterThan(plaintext.length);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('funciona com caracteres UTF-8', () => {
    const plaintext = 'áéíóú 中文 🚀 Kairós';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });
});

describe('Crypto AES-256-GCM — IV random', () => {
  it('mesmo plaintext gera ciphertexts diferentes', () => {
    const plaintext = 'same-secret';
    const ct1 = encrypt(plaintext);
    const ct2 = encrypt(plaintext);
    const ct3 = encrypt(plaintext);
    expect(ct1).not.toBe(ct2);
    expect(ct2).not.toBe(ct3);
    expect(ct1).not.toBe(ct3);
  });

  it('cada ciphertext tem IV diferente', () => {
    const cts = Array.from({ length: 10 }, () => encrypt('test'));
    const ivs = cts.map((c) => c.split('.')[0]);
    expect(new Set(ivs).size).toBe(10); // todos diferentes
  });
});

describe('Crypto AES-256-GCM — formato', () => {
  it('ciphertext tem formato iv.tag.ciphertext (3 partes separadas por ponto)', () => {
    const ct = encrypt('test');
    const parts = ct.split('.');
    expect(parts).toHaveLength(3);
    // iv: 12 bytes → base64url ~ 16 chars
    expect(parts[0].length).toBeGreaterThanOrEqual(14);
    expect(parts[0].length).toBeLessThanOrEqual(18);
    // tag: 16 bytes → base64url ~ 22 chars
    expect(parts[1].length).toBeGreaterThanOrEqual(20);
    expect(parts[1].length).toBeLessThanOrEqual(24);
  });
});

describe('Crypto AES-256-GCM — tamper detection', () => {
  it('modificar ciphertext (último char) falha no decrypt', () => {
    const ct = encrypt('secret');
    const parts = ct.split('.');
    // Modifica o último char do ciphertext
    const tampered =
      parts[0] + '.' + parts[1] + '.' + (parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a'));
    expect(() => decrypt(tampered)).toThrow();
  });

  it('modificar IV falha no decrypt', () => {
    const ct = encrypt('secret');
    const parts = ct.split('.');
    const newIv = Buffer.from('000000000000').toString('base64url');
    const tampered = newIv + '.' + parts[1] + '.' + parts[2];
    expect(() => decrypt(tampered)).toThrow();
  });

  it('modificar auth tag falha no decrypt', () => {
    const ct = encrypt('secret');
    const parts = ct.split('.');
    // Modifica o primeiro char do tag
    const newTag = (parts[1][0] === 'A' ? 'B' : 'A') + parts[1].slice(1);
    const tampered = parts[0] + '.' + newTag + '.' + parts[2];
    expect(() => decrypt(tampered)).toThrow();
  });

  it('ciphertext malformado (1 parte só) falha', () => {
    expect(() => decrypt('abcdef')).toThrow('malformado');
  });

  it('ciphertext malformado (5 partes) falha', () => {
    expect(() => decrypt('a.b.c.d.e')).toThrow('malformado');
  });

  it('IV com tamanho errado falha', () => {
    const ct = encrypt('test');
    const parts = ct.split('.');
    // IV de 6 bytes (deveria ser 12)
    const shortIv = Buffer.from('short12').toString('base64url');
    const tampered = shortIv + '.' + parts[1] + '.' + parts[2];
    expect(() => decrypt(tampered)).toThrow(/IV inválido/);
  });

  it('auth tag com tamanho errado falha', () => {
    const ct = encrypt('test');
    const parts = ct.split('.');
    const shortTag = Buffer.from('shortag').toString('base64url');
    const tampered = parts[0] + '.' + shortTag + '.' + parts[2];
    expect(() => decrypt(tampered)).toThrow(/Auth tag inválida/);
  });
});

describe('generateMasterKey', () => {
  it('gera 32 bytes em base64url (43 chars)', () => {
    const key = generateMasterKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    const decoded = Buffer.from(key, 'base64url');
    expect(decoded.length).toBe(32);
  });

  it('gera keys únicas em sequência', () => {
    const k1 = generateMasterKey();
    const k2 = generateMasterKey();
    expect(k1).not.toBe(k2);
  });
});