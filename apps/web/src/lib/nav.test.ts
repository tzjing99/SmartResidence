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
