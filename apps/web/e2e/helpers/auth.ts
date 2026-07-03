import { type Page, expect } from '@playwright/test';

export const E2E_PASSWORD = 'Demo!2026';

const apiURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function signIn(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 });
}

/** Desktop uses the sidebar control; mobile calls the API then opens sign-in. */
export async function signOut(page: Page) {
  const desktopBtn = page.locator('aside').getByRole('button', { name: /sign out/i });
  if (await desktopBtn.isVisible()) {
    await desktopBtn.click();
  } else {
    await page.request.post(`${apiURL}/api/auth/sign-out`);
    await page.goto('/sign-in');
  }
  await expect(page).toHaveURL(/sign-in/, { timeout: 15_000 });
}
