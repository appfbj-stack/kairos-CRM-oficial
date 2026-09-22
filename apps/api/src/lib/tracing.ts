/**
 * Tracing — OpenTelemetry stub (NoOp por padrão).
 *
 * Estado atual (Fase 1):
 *   - API mínima interna (withSpan, addEvent, setAttribute)
 *   - NoOpTracer default → zero overhead, zero deps
 *   - Se OTEL_EXPORTER_OTLP_ENDPOINT estiver setado, ativa export OTLP/HTTP
 *     usando `@opentelemetry/*` (instalado só quando Pastor quiser).
 *
 * Para ativar tracing real em produção:
 *   1. Adicionar deps:
 *      @opentelemetry/api
 *      @opentelemetry/sdk-node
 *      @opentelemetry/exporter-trace-otlp-http
 *      @opentelemetry/instrumentation-http
 *      @opentelemetry/instrumentation-fastify
 *      @opentelemetry/instrumentation-prisma
 *   2. Setar env:
 *      OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
 *      OTEL_SERVICE_NAME=kairos-crm-api
 *   3. Importar initTracing() no topo de server.ts (antes do Fastify).
 *
 * Uso (não muda quando ativar backend real):
 *   await withSpan('crm.lead.create', async (span) => {
 *     span.setAttribute('tenant.id', tenantId);
 *     span.setAttribute('lead.id', leadId);
 *     return await createLead(...);
 *   });
 */

import { logger } from './logger';

// =====================================================
// Tipos mínimos (compatíveis com OpenTelemetry API)
// =====================================================

export interface Span {
  name: string;
  setAttribute(key: string, value: string | number | boolean): void;
  setAttributes(attrs: Record<string, string | number | boolean>): void;
  addEvent(name: string, attrs?: Record<string, any>): void;
  recordException(err: Error): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string, attrs?: Record<string, any>): Span;
}

// =====================================================
// NoOp implementation
// =====================================================

const noopSpan: Span = {
  name: 'noop',
  setAttribute: () => {},
  setAttributes: () => {},
  addEvent: () => {},
  recordException: () => {},
  end: () => {},
};

const noopTracer: Tracer = {
  startSpan: () => noopSpan,
};

let activeTracer: Tracer = noopTracer;

// =====================================================
// Ativação lazy do backend OTLP (quando OTEL_EXPORTER_OTLP_ENDPOINT setado)
// =====================================================

let initialized = false;

export async function initTracing(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    logger.debug('tracing desabilitado (OTEL_EXPORTER_OTLP_ENDPOINT não setado)');
    return;
  }

  try {
    // Imports dinâmicos — pacotes opcionais, só carrega se OTLP ativado.
    const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
    const otelApi = await dynamicImport('@opentelemetry/api' as string).catch(() => null);
    if (!otelApi) {
      logger.warn('@opentelemetry/api não instalado — tracing desabilitado');
      return;
    }

    const sdkNode = await dynamicImport('@opentelemetry/sdk-node' as string).catch(() => null);
    const exporter = await dynamicImport('@opentelemetry/exporter-trace-otlp-http' as string).catch(() => null);
    if (!sdkNode || !exporter) {
      logger.warn('pacotes OTel não instalados — tracing desabilitado');
      return;
    }

    const { NodeSDK } = sdkNode;
    const { OTLPTraceExporter } = exporter;

    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      serviceName: process.env.OTEL_SERVICE_NAME || 'kairos-crm-api',
    });
    sdk.start();

    activeTracer = otelApi.trace.getTracer('kairos-crm-api');
    logger.info({ endpoint, service: process.env.OTEL_SERVICE_NAME }, 'tracing OTel ativado');
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'falha ao inicializar tracing — NoOp ativo');
  }
}

export function getTracer(): Tracer {
  return activeTracer;
}

// =====================================================
// Helpers de uso
// =====================================================

/**
 * Wrap uma operação num span. Se o tracing estiver desabilitado (NoOp),
 * é apenas um `await fn()`.
 *
 * Erros são registrados no span e re-thrown.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attrs?: Record<string, any>,
): Promise<T> {
  const span = activeTracer.startSpan(name, attrs);
  try {
    const result = await fn(span);
    return result;
  } catch (err) {
    span.recordException(err as Error);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Helper para medir tempo de execução de função sync (sem span).
 */
export async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const durationMs = Date.now() - start;
    if (durationMs > 1000) {
      logger.warn({ name, durationMs }, 'operação lenta detectada');
    }
  }
}