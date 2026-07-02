import { expect, test } from '@playwright/test';
import { signIn, signOut } from './helpers/auth';
import { expectManageAccessNav } from './helpers/nav';

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
  await expectManageAccessNav(page);

  await signOut(page);

  await signIn(page, 'guard@acacia.demo');
  await expect(page).toHaveURL(/\/guard/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /on site now/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /manage access/i })).toHaveCount(0);
});
