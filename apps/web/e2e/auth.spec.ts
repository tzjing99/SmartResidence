import { expect, test } from '@playwright/test';

const PASSWORD = 'Demo!2026';

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test('sign-in form validates email + password', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: /sign in/i }).click();
  // Browser-native HTML validation should keep us on the page.
  await expect(page).toHaveURL(/sign-in/);
});

test('shows informative error on bad credentials', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill('nobody@example.com');
  await page.getByLabel(/password/i).fill('wrongpassword');
  await page.getByRole('button', { name: /sign in/i }).click();
  // Sonner error toast (scope to the toast itself; Next's route announcer also
  // carries role="alert", which would otherwise trip strict-mode matching).
  await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 8_000 });
});

test('sign out clears session so the next user gets their own role', async ({ page }) => {
  await signIn(page, 'owner@acacia.demo');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByRole('link', { name: /manage access/i })).toBeVisible();

  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/sign-in/, { timeout: 15_000 });

  await signIn(page, 'guard@acacia.demo');
  await expect(page).toHaveURL(/\/guard/, { timeout: 15_000 });
  await expect(page.getByText(/visitor verification/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /manage access/i })).toHaveCount(0);
});
