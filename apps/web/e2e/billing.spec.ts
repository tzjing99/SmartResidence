import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

test('admin accounting page loads with export CSV actions', async ({ page }) => {
  await signIn(page, 'admin@acacia.demo');
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });

  await page.goto('/admin/accounting');
  await expect(page.getByRole('heading', { name: 'Accounting' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('button', { name: 'Export CSV' }).first()).toBeVisible();
});
