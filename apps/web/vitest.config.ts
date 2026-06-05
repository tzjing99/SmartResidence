import { configDefaults, defineConfig } from 'vitest/config';

// The `e2e/**` specs are Playwright suites driven by `pnpm test:e2e`; Vitest
// must not collect them or it errors with "Playwright Test did not expect
// test() to be called here". There are no Vitest unit suites yet, so allow an
// empty run (mirrors the mobile package's `jest --passWithNoTests`).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
    passWithNoTests: true,
  },
});
