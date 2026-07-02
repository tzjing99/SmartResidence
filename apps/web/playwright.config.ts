import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.SMARTRESIDENCE_WEB_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // In CI the app is already built, so serve the production build; locally
    // use the dev server and reuse one if it's already running.
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      // The management/resident portals are desktop-only (their sidebar nav is
      // `hidden md:flex` with no mobile menu), so the role-routing nav
      // assertions only make sense on a desktop viewport. The mobile project
      // still covers the public/responsive flows (landing, auth, thread guards).
      testIgnore: /role-routing\.spec\.ts|billing\.spec\.ts/,
    },
  ],
});
