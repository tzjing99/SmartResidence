import type { Page } from '@playwright/test';

export const E2E_PASSWORD = 'Demo!2026';

export async function signIn(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}
