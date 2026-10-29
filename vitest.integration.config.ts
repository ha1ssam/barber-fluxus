import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Testes com banco de verdade. Usa TEST_DATABASE_URL (as migrações são aplicadas antes; cada teste cria a própria loja).
const url = process.env.TEST_DATABASE_URL || 'postgresql://fluxus:fluxus@localhost:5432/fluxus_test';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), 'server-only': path.resolve(__dirname, 'tests/stubs/empty.ts') } },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/integration/global-setup.ts'],
    env: { DATABASE_URL: url, TZ: 'UTC', NODE_ENV: 'test', APP_URL: 'http://localhost:3000' },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
