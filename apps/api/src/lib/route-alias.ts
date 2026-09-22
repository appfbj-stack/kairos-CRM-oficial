/**
 * Route Alias Helper — Fase 1 preparação para /api/v1/internal/*
 *
 * Permite registrar uma rota em DOIS paths simultaneamente:
 *   - Path original:    /api/contacts
 *   - Path versionado:  /api/v1/internal/contacts
 *
 * Plano de migração:
 *   - F1 (agora): helper criado + aplicado em rotas públicas (health)
 *   - F2: rotas autenticadas começam a usar registerWithAlias
 *   - F3+: novos módulos externos vão direto em /api/v1/external/* (Fase 2)
 *
 * Garante zero quebra no frontend durante migração.
 */

import type { FastifyInstance, RouteOptions } from 'fastify';

export interface AliasableRouteOptions extends Omit<RouteOptions, 'method' | 'url'> {
  method: RouteOptions['method'];
  url: string;
}

export function registerWithAlias(app: FastifyInstance, opts: AliasableRouteOptions): void {
  // Rota original (mantém compat)
  app.route(opts);

  // Alias versionado — só pra paths que começam com /api/
  if (opts.url.startsWith('/api/')) {
    const aliasedUrl = `/api/v1/internal${opts.url.slice(4)}`; // strip '/api' prefix
    app.route({ ...opts, url: aliasedUrl });
  }
}

/**
 * Versão typed pra schemas Zod.
 */
export function aliasRoute<S extends Record<string, any>>(
  app: FastifyInstance,
  opts: AliasableRouteOptions & { schema?: S },
): void {
  registerWithAlias(app, opts);
}