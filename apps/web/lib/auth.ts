/**
 * Auth helpers — server-side (cookies httpOnly) e client-side (localStorage).
 *
 * Server-side: usa cookies httpOnly para guardar access + refresh.
 * Client-side: usa localStorage como fallback.
 */

import { cookies } from 'next/headers';
import { apiFetch, ApiClientError } from './api';
import type { LoginResponse } from '@kairos-crm/shared';

const ACCESS_COOKIE = 'kcrm_access';
const REFRESH_COOKIE = 'kcrm_refresh';

export async function loginRequest(input: {
  email: string;
  password: string;
  tenantSlug?: string;
}): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: input,
  });
}

export async function registerRequest(input: {
  tenantName: string;
  tenantSlug: string;
  tenantEmail: string;
  tenantPhone?: string;
  name: string;
  email: string;
  password: string;
}): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/register', {
    method: 'POST',
    body: input,
  });
}

export async function meRequest(accessToken: string) {
  return apiFetch<{
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string | null;
    tenantSlug: string | null;
    tenantName: string | null;
  }>('/api/auth/me', {
    accessToken,
  });
}

// ----- Server-side cookie helpers -----

export async function setAuthCookies(tokens: { accessToken: string; refreshToken: string }) {
  const c = cookies();
  c.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15, // 15min
  });
  c.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7d
  });
}

export function getAccessToken(): string | undefined {
  return cookies().get(ACCESS_COOKIE)?.value;
}

export function clearAuthCookies() {
  const c = cookies();
  c.delete(ACCESS_COOKIE);
  c.delete(REFRESH_COOKIE);
}

export { ApiClientError };
