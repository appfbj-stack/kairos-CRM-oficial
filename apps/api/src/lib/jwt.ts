import { createHash, randomBytes } from 'crypto';
import { createSigner, createVerifier } from 'fast-jwt';
import { env } from '../config/env';
import { parseDurationToMs } from '@kairos-crm/shared';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '@kairos-crm/shared';

// Signers/verifiers are created once with the secret (faster than per-call)
const accessSigner = createSigner({
  key: async () => env.JWT_SECRET,
  expiresIn: parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN),
});

const accessVerifier = createVerifier({
  key: async () => env.JWT_SECRET,
});

const refreshSigner = createSigner({
  key: async () => env.JWT_REFRESH_SECRET,
  expiresIn: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
});

const refreshVerifier = createVerifier({
  key: async () => env.JWT_REFRESH_SECRET,
});

export function signAccessToken(payload: Omit<AccessTokenPayload, 'type' | 'iat' | 'exp'>) {
  return Promise.resolve(accessSigner({ ...payload, type: 'access' }));
}

export function signRefreshToken(payload: { sub: string; jti: string }) {
  return Promise.resolve(refreshSigner({ ...payload, type: 'refresh' }));
}

export function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  return accessVerifier(token) as Promise<AccessTokenPayload>;
}

export function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  return refreshVerifier(token) as Promise<RefreshTokenPayload>;
}

/**
 * Gera um token opaco + hash.
 * O plaintext vai pro cliente; o hash fica no banco.
 */
export function generateRefreshToken(): { token: string; hash: string; jti: string } {
  const jti = randomBytes(16).toString('hex');
  const secret = randomBytes(32).toString('hex');
  return {
    token: `${jti}.${secret}`,
    hash: createHash('sha256').update(`${jti}.${secret}`).digest('hex'),
    jti,
  };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
