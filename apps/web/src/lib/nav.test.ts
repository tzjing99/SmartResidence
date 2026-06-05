import { describe, expect, it } from 'vitest';
import { isActiveHref, resolveActiveHref } from './nav';

const ADMIN_HREFS = [
  '/admin',
  '/admin/units',
  '/admin/visitors',
  '/admin/invoices',
  '/admin/audit',
];

describe('resolveActiveHref', () => {
  it('keeps the index route active only on its exact path', () => {
    expect(resolveActiveHref('/admin', ADMIN_HREFS)).toBe('/admin');
  });

  it('does NOT keep the index route active on a sibling sub-route (the bug)', () => {
    expect(resolveActiveHref('/admin/units', ADMIN_HREFS)).toBe('/admin/units');
    expect(resolveActiveHref('/admin/visitors', ADMIN_HREFS)).toBe('/admin/visitors');
  });

  it('picks the longest (most specific) matching href for nested routes', () => {
    expect(resolveActiveHref('/admin/units/123', ADMIN_HREFS)).toBe('/admin/units');
    expect(resolveActiveHref('/admin/units/123/edit', ADMIN_HREFS)).toBe('/admin/units');
  });

  it('does not match unrelated routes that merely share a prefix string', () => {
    expect(resolveActiveHref('/admin-tools', ['/admin'])).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(resolveActiveHref('/somewhere-else', ADMIN_HREFS)).toBeNull();
  });

  it('keeps settings parent active only on exact path when a longer sibling exists', () => {
    const settingsHrefs = ['/settings', '/settings/sla-audit'];
    expect(resolveActiveHref('/settings', settingsHrefs)).toBe('/settings');
    expect(resolveActiveHref('/settings/sla-audit', settingsHrefs)).toBe('/settings/sla-audit');
  });

  it('highlights nested admin settings routes', () => {
    const adminSettingsHrefs = ['/admin/settings', '/admin/settings/helpdesk', '/admin/settings/audit'];
    expect(resolveActiveHref('/admin/settings/helpdesk', adminSettingsHrefs)).toBe(
      '/admin/settings/helpdesk',
    );
    expect(resolveActiveHref('/admin/settings/audit', adminSettingsHrefs)).toBe(
      '/admin/settings/audit',
    );
    expect(resolveActiveHref('/admin/settings/notifications', adminSettingsHrefs)).toBe(
      '/admin/settings',
    );
  });
});

describe('isActiveHref', () => {
  it('marks only the most specific sibling as active', () => {
    expect(isActiveHref('/admin/units', '/admin/units', ADMIN_HREFS)).toBe(true);
    expect(isActiveHref('/admin/units', '/admin', ADMIN_HREFS)).toBe(false);
  });

  it('marks the index active on its own route', () => {
    expect(isActiveHref('/admin', '/admin', ADMIN_HREFS)).toBe(true);
  });
});
