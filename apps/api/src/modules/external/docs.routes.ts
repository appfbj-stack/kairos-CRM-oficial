/**
 * Documentação OpenAPI da API externa.
 *
 *   GET /api/v1/external/docs.json    — serve o OpenAPI 3.1 em JSON
 *   GET /api/v1/external/docs         — Swagger UI (carrega via CDN unpkg)
 *
 * Spec: /docs/external-api/openapi.yaml (gerado manualmente; pode evoluir
 * pra gerador Zod→OpenAPI se Pastor quiser).
 */

import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../../lib/logger';

// Carrega o YAML no boot (síncrono — arquivos pequenos)
let OPENAPI_YAML: string;
let OPENAPI_JSON: any;

try {
  // Em produção, o spec fica em /app/docs/external-api/openapi.yaml
  // Em dev, fica em ../../docs/external-api/openapi.yaml (relativo a src/)
  const candidates = [
    resolve(__dirname, '../../../../docs/external-api/openapi.yaml'),
    resolve(__dirname, '../../../docs/external-api/openapi.yaml'),
    resolve(process.cwd(), 'docs/external-api/openapi.yaml'),
  ];
  let yaml: string | null = null;
  for (const path of candidates) {
    try {
      yaml = readFileSync(path, 'utf8');
      logger.info({ path }, 'OpenAPI spec carregado');
      break;
    } catch { /* tenta próximo */ }
  }
  if (!yaml) {
    logger.warn('OpenAPI spec não encontrado em nenhum path conhecido');
    yaml = '# OpenAPI spec não disponível\n';
  }
  OPENAPI_YAML = yaml;
  // Conversão simples YAML → JSON não é trivial sem dep;
  // Aqui apenas servimos YAML e linkamos pra Swagger UI de CDN.
  // Apps podem usar redoc-cli ou similar pra converter local.
  OPENAPI_JSON = null;
} catch (err) {
  logger.error({ err: (err as Error).message }, 'falha ao carregar OpenAPI spec');
  OPENAPI_YAML = '# erro\n';
}

export async function externalDocsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/external/docs — Swagger UI standalone (carrega via CDN)
  app.get('/api/v1/external/docs', async (_req, reply) => {
    reply.type('text/html; charset=utf-8');
    return reply.send(SWAGGER_UI_HTML);
  });

  // GET /api/v1/external/docs.yaml — spec cru (YAML)
  app.get('/api/v1/external/docs.yaml', async (_req, reply) => {
    reply.type('application/yaml; charset=utf-8');
    return reply.send(OPENAPI_YAML);
  });

  // GET /api/v1/external/docs.json — best-effort JSON (se conseguirmos parsear)
  app.get('/api/v1/external/docs.json', async (_req, reply) => {
    if (OPENAPI_JSON) {
      return reply.send(OPENAPI_JSON);
    }
    // Fallback: serve YAML embrulhado em JSON (algumas ferramentas aceitam)
    return reply.send({ _yaml: OPENAPI_YAML, _note: 'Use docs.yaml para spec oficial' });
  });
}

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kairos CRM — API Externa</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .topbar { background: #0f172a; color: #f8fafc; padding: 12px 24px; }
    .topbar h1 { margin: 0; font-size: 18px; font-weight: 600; }
    .topbar a { color: #94a3b8; text-decoration: none; margin-left: 16px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>🟢 Kairos CRM — External API v1</h1>
    <a href="/api/v1/external/docs.yaml" target="_blank">Download OpenAPI YAML</a>
    <a href="/api/v1/external/health" target="_blank">Health check</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/external/docs.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: 'BaseLayout',
        defaultModelsExpandDepth: -1,
        docExpansion: 'list',
        filter: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`;