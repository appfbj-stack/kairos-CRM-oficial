import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Carrega .env da raiz do monorepo (DATABASE_URL, JWT_SECRET, etc)
// Node 20.6+ tem loadEnvFile nativo — sem dependência extra
try {
  process.loadEnvFile(resolve(__dirname, '../../.env'));
} catch (err) {
  console.warn('[vitest.config] .env não carregado:', (err as Error).message);
}

// Garante KAIROS_API_MASTER_KEY setada pros testes de crypto
// (32 bytes em base64 = 43 chars após decode → 32 bytes)
if (!process.env.KAIROS_API_MASTER_KEY) {
  // Master key determinística só pra testes — NÃO use em produção
  // 32 bytes em base64 (decodifica pra 32 bytes após base64 decode)
  process.env.KAIROS_API_MASTER_KEY =
    Buffer.from('kairos_test_master_key_32bytes!!').toString('base64');
}

/**
 * Config mínima do Vitest para a API.
 * Existe porque o vitest procura vite.config.ts subindo diretórios
 * e está pegando o vite.config.ts de C:\Users\ferna\ (de outro projeto).
 * Sem plugins de UI aqui — só test runner.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks', // evita singleton Prisma compartilhado
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});