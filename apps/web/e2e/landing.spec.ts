import { expect, test } from '@playwright/test';

test('landing page renders SmartResidence branding and CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SmartResidence/i);
  await expect(page.getByRole('heading', { name: /SmartResidence/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /get started|sign up/i })).toBeVisible();
});

test('navigates to sign-in page', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('link', { name: /sign in/i })
    .first()
    .click();
  await expect(page).toHaveURL(/sign-in/);
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});
