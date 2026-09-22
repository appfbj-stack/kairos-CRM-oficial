/**
 * Teste unitário: AsyncLocalStorage isolation (Fase 1 refactor).
 *
 * Valida que o novo tenant context via AsyncLocalStorage não sofre
 * race condition quando múltiplas "requests" são processadas em paralelo.
 *
 * Não precisa de DB — testa só o mecanismo de contexto.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setTenantContext,
  getTenantContext,
  withTenantContext,
  getTenantContextDebug,
} from '@kairos-crm/database';

describe('Tenant context — AsyncLocalStorage isolation', () => {
  it('fora de run, retorna null', () => {
    expect(getTenantContext()).toBeNull();
    expect(getTenantContextDebug().active).toBe(false);
  });

  it('setTenantContext dentro de run é visível para a continuation async', () => {
    withTenantContext('tenant-A', async () => {
      expect(getTenantContext()).toBe('tenant-A');
      await Promise.resolve(); // simula microtask
      expect(getTenantContext()).toBe('tenant-A');
    });
  });

  it('setTenantContext fora de run usa enterWith e afeta o escopo atual', async () => {
    setTenantContext('tenant-X');
    expect(getTenantContext()).toBe('tenant-X');
    await Promise.resolve();
    expect(getTenantContext()).toBe('tenant-X');
  });

  it('requests PARALELAS não se sobrescrevem', async () => {
    // Simula 100 requests chegando ao mesmo tempo, cada uma com seu tenantId
    const tasks = Array.from({ length: 100 }, (_, i) => {
      const tenantId = `tenant-${i}`;
      return withTenantContext(tenantId, async () => {
        // Simula trabalho async (delay aleatório)
        await new Promise((r) => setTimeout(r, Math.random() * 10));
        // O tenant ainda deve ser o desta "request"
        expect(getTenantContext()).toBe(tenantId);
      });
    });

    await Promise.all(tasks);
    // Após tudo, contexto volta a null
    expect(getTenantContext()).toBeNull();
  });

  it('requests ANINHADAS herdam contexto, mas não vazam pra fora', async () => {
    await withTenantContext('outer', async () => {
      expect(getTenantContext()).toBe('outer');

      await withTenantContext('inner', async () => {
        expect(getTenantContext()).toBe('inner');
      });

      // Voltou pro outer
      expect(getTenantContext()).toBe('outer');
    });

    // Fora do run, contexto volta a null
    expect(getTenantContext()).toBeNull();
  });

  it('setTenantContext dentro de withTenantContext faz shadow do outer', async () => {
    await withTenantContext('outer', async () => {
      expect(getTenantContext()).toBe('outer');
      setTenantContext('shadowed'); // enterWith dentro do run
      expect(getTenantContext()).toBe('shadowed');
      await Promise.resolve();
      expect(getTenantContext()).toBe('shadowed');
    });
    expect(getTenantContext()).toBeNull();
  });

  it('preserva contexto através de awaits em cadeia', async () => {
    await withTenantContext('tenant-async', async () => {
      const result = await Promise.resolve(1)
        .then(async (n) => {
          // Continuation separada — ALS deve preservar
          expect(getTenantContext()).toBe('tenant-async');
          return n + 1;
        })
        .then(async (n) => {
          expect(getTenantContext()).toBe('tenant-async');
          return n + 1;
        });
      expect(result).toBe(3);
      expect(getTenantContext()).toBe('tenant-async');
    });
  });
});