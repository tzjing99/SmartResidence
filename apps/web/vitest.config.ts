import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

// The `e2e/**` specs are Playwright suites driven by `pnpm test:e2e`; Vitest
// must not collect them or it errors with "Playwright Test did not expect
// test() to be called here". There are no Vitest unit suites yet, so allow an
// empty run (mirrors the mobile package's `jest --passWithNoTests`).
export default defineConfig({
  // Use the automatic JSX runtime so `.tsx` sources (e.g. the Markdown
  // component) compile in tests without an explicit React import.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
    passWithNoTests: true,
  },
});
