import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
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
