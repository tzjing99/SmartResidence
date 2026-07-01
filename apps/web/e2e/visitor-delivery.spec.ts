import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

test('resident visitors page shows delivery pass quick form', async ({ page }) => {
  await signIn(page, 'owner@acacia.demo');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.goto('/visitors');
  await expect(page.getByRole('button', { name: /delivery \/ rider pass/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole('button', { name: /delivery \/ rider pass/i }).click();
  await expect(page.getByLabel(/pass type/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create delivery pass' })).toBeVisible();
});
