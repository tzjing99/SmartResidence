import { expect, test } from '@playwright/test';

test('landing page renders SmartResidence branding and CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SmartResidence/i);
  // Brand wordmark (rendered as a styled element, split across text nodes).
  await expect(page.getByText('SmartResidence').first()).toBeVisible();
  // Hero headline (badge still mentions condo management; h1 is product-led).
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/run your building/i);
  await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
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
