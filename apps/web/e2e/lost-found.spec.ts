import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

test('resident can open lost & found and see the post form', async ({ page }) => {
  await signIn(page, 'owner@acacia.demo');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.goto('/lost-found');
  await expect(page.getByRole('heading', { level: 1, name: /lost & found/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('heading', { name: 'Post to the board' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post to board' })).toBeVisible();
});
