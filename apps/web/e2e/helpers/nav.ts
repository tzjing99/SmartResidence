import { expect, type Page } from '@playwright/test';

/** Owner-only nav item — visible in the desktop sidebar or the mobile overflow menu. */
export async function expectManageAccessNav(page: Page) {
  const desktopLink = page.locator('aside').getByRole('link', { name: /manage access/i });
  if (await desktopLink.isVisible()) {
    await expect(desktopLink).toBeVisible();
    return;
  }

  await page.getByRole('button', { name: /open menu/i }).click();
  await expect(
    page
      .getByRole('navigation', { name: 'Resident navigation' })
      .getByRole('link', { name: /manage access/i }),
  ).toBeVisible();
}
