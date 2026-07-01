import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

test('admin governance page loads', async ({ page }) => {
  await signIn(page, 'admin@acacia.demo');
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });

  await page.goto('/admin/governance');
  await expect(page.getByRole('heading', { name: 'Governance' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('heading', { name: 'New meeting' })).toBeVisible();
});
