import { expect, test } from '@playwright/test';
import { signIn } from './helpers/auth';
import { expectManageAccessNav } from './helpers/nav';

test('unit owner lands on the resident dashboard with owner-empowerment nav', async ({ page }) => {
  await signIn(page, 'owner@acacia.demo');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  // Owner-only surface (revoke RoleAssignment) is visible.
  await expectManageAccessNav(page);
  // .and management-only nav is absent; SLA history is nested under Settings.
  await expect(page.getByRole('link', { name: /audit log/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
});

test('management admin lands on the /admin portal', async ({ page }) => {
  await signIn(page, 'admin@acacia.demo');
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
  const sidebar = page.getByRole('navigation');
  await expect(sidebar.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  // Config surfaces live under Settings, not the main sidebar.
  await expect(sidebar.getByRole('link', { name: 'Audit log', exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'SLA settings', exact: true })).toHaveCount(0);

  await sidebar.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings/, { timeout: 15_000 });
  // Settings hub uses category cards; sub-nav appears on sub-pages.
  await page.goto('/admin/settings/audit');
  await expect(page).toHaveURL(/\/admin\/settings\/audit/, { timeout: 15_000 });
  const settingsNav = page.getByRole('navigation', { name: 'Settings sections' });
  await expect(settingsNav.getByRole('link', { name: 'Audit log', exact: true })).toBeVisible();
  await expect(
    settingsNav.getByRole('link', { name: 'Roles & access', exact: true }),
  ).toBeVisible();
});

test('admin nav highlights the active route and not the dashboard index', async ({ page }) => {
  await signIn(page, 'admin@acacia.demo');
  await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
  const sidebar = page.getByRole('navigation');
  const dashboard = sidebar.getByRole('link', { name: 'Dashboard', exact: true });
  const units = sidebar.getByRole('link', { name: 'Residents & units', exact: true });

  // On the index route, only Dashboard is current.
  await expect(dashboard).toHaveAttribute('aria-current', 'page');
  await expect(units).not.toHaveAttribute('aria-current', 'page');

  // Click Units → highlight moves to Units, Dashboard is no longer active.
  await units.click();
  await expect(page).toHaveURL(/\/admin\/units/, { timeout: 15_000 });
  await expect(units).toHaveAttribute('aria-current', 'page');
  await expect(dashboard).not.toHaveAttribute('aria-current', 'page');
});

test('security guard lands on the minimal /guard view', async ({ page }) => {
  await signIn(page, 'guard@acacia.demo');
  await expect(page).toHaveURL(/\/guard/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /on site now/i })).toBeVisible();
  // No resident or admin navigation for guards.
  await expect(page.getByRole('link', { name: /manage access/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /audit log/i })).toHaveCount(0);
});

test('resident is redirected away from /admin to their home', async ({ page }) => {
  await signIn(page, 'owner@acacia.demo');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
});

test('guard is redirected away from resident pages to the gate view', async ({ page }) => {
  await signIn(page, 'guard@acacia.demo');
  await expect(page).toHaveURL(/\/guard/, { timeout: 15_000 });
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/guard/, { timeout: 15_000 });
});
