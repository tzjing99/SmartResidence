import { expect, test } from '@playwright/test';

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
