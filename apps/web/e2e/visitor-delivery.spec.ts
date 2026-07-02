import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';

test('resident visitors page shows delivery pass quick form', async ({ page }) => {
  await signIn(page, 'owner@acacia.demo');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.goto('/visitors');
  const deliveryToggle = page.getByRole('button', { name: /expecting food or a rider/i });
  await expect(deliveryToggle).toBeVisible({ timeout: 15_000 });

  await deliveryToggle.click();
  await expect(page.getByText(/what kind of visit/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pass' })).toBeVisible();
});
