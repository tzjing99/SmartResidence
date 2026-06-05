import { expect, test } from '@playwright/test';

/**
 * Threads/helpdesk are gated behind auth + role. Unauthenticated visits should
 * be bounced to the sign-in page by the client-side role guard.
 */
test('unauthenticated resident messages route redirects to sign-in', async ({ page }) => {
  await page.goto('/messages');
  await expect(page).toHaveURL(/sign-in/, { timeout: 10_000 });
});

test('unauthenticated admin helpdesk route redirects to sign-in', async ({ page }) => {
  await page.goto('/admin/helpdesk');
  await expect(page).toHaveURL(/sign-in/, { timeout: 10_000 });
});
