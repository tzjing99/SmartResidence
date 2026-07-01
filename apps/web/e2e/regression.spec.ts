import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

test.describe('Regression smoke: role home routes', () => {
  test('management admin lands on /admin', async ({ page }) => {
    await signIn(page, 'admin@acacia.demo');
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('unit owner lands on resident dashboard', async ({ page }) => {
    await signIn(page, 'owner@acacia.demo');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole('link', { name: /manage access/i })).toBeVisible();
  });

  test('security guard lands on gate view', async ({ page }) => {
    await signIn(page, 'guard@acacia.demo');
    await expect(page).toHaveURL(/\/guard/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /on site now/i })).toBeVisible();
  });
});
