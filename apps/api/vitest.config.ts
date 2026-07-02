import { dirname, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Load apps/api/.env so @requires-db suites see DATABASE_URL at collection time
// (CI sets DATABASE_URL explicitly in the workflow env).
try {
  loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), '.env'));
} catch {
  // No local .env — integration tests skip unless DATABASE_URL is exported in the shell.
}

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./test/vitest.setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'test/**/*.spec.ts'],
    globals: true,
    reporters: process.env.CI ? ['default', 'html'] : ['default'],
    outputFile: process.env.CI ? { html: './vitest-report/index.html' } : undefined,
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
