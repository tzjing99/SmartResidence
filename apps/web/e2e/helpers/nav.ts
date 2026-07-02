import { type Page, expect } from '@playwright/test';

/** Owner-only surface — desktop sidebar link or mobile overflow menu entry. */
export async function expectManageAccessNav(page: Page) {
  const desktopLink = page.locator('aside').getByRole('link', { name: /manage access/i });
  if (await desktopLink.isVisible()) {
    await expect(desktopLink).toBeVisible();
    return;
  }

  const menuButton = page.getByRole('button', { name: /open menu/i });
  await expect(menuButton).toBeVisible({ timeout: 15_000 });
  await menuButton.click();
  const mobileNav = page.getByRole('navigation', { name: 'Resident navigation' });
  await expect(mobileNav.getByRole('link', { name: /manage access/i })).toBeVisible({
    timeout: 15_000,
  });
}
