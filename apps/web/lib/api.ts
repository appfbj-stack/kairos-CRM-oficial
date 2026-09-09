/**
 * Cliente HTTP para a API do Kairos CRM.
 * - Server-side (RSC, route handlers, server actions): usa NEXT_PUBLIC_API_URL
 *   ou fallback pra dev local.
 * - Client-side: usa URL RELATIVA (`/api/...`) — o Caddy/proxy reverso
 *   roteia `/api/*` pra API no mesmo domínio. Isso evita CORS e problema
 *   de NEXT_PUBLIC_* precisar estar setado no build time.
 */

function getApiBase(): string {
  if (typeof window !== 'undefined') {
    // Browser: usa URL relativa (Caddy faz o proxy)
    return '';
  }
  // Server-side: usa INTERNAL_API_URL (dentro do dokploy-network),
  // cai pra NEXT_PUBLIC_API_URL, e por último dev local.
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  );
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  constructor(public status: number, public body: { error: ApiError }) {
    super(body.error.message);
    this.name = 'ApiClientError';
  }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  accessToken?: string;
}

export async function apiFetch<T = any>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { body, accessToken, headers, ...rest } = options;

  const base = getApiBase();
  const hasBody = body !== undefined && body !== null;
  // Client-side: se nenhum accessToken foi passado, tenta pegar do localStorage automaticamente.
  // Isso evita ter que passar manualmente em todos os componentes client.
  let token = accessToken;
  if (!token && typeof window !== 'undefined') {
    try {
      token = window.localStorage.getItem('kcrm_access') || undefined;
    } catch {
      // localStorage pode falhar em modo privado; segue sem token
    }
  }
  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers as any),
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiClientError(res.status, data);
  }

  return data as T;
}
