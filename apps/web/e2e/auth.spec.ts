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
  // Sonner toast or inline error
  await expect(page.locator('[role="alert"], [data-sonner-toast]')).toBeVisible({ timeout: 8_000 });
});
