import { describe, expect, it } from 'vitest';
import { webHrefForNotification } from './notification-href';

describe('webHrefForNotification', () => {
  it('maps a deeplink to an in-app path', () => {
    expect(webHrefForNotification({ data: { deeplink: 'smartresidence://visitors' } })).toBe(
      '/visitors',
    );
  });

  it('maps an admin deeplink to an in-app admin path', () => {
    expect(webHrefForNotification({ data: { deeplink: 'smartresidence://admin/safety' } })).toBe(
      '/admin/safety',
    );
  });

  it('never returns a protocol-relative path for malformed deeplinks (open-redirect guard)', () => {
    const href = webHrefForNotification({
      data: { deeplink: 'smartresidence:////evil.com' },
    });
    expect(href).not.toBeNull();
    expect(href?.startsWith('//')).toBe(false);
    expect(href).toBe('/evil.com');
  });

  it('returns null for an empty deeplink', () => {
    expect(webHrefForNotification({ data: { deeplink: 'smartresidence://' } })).toBeNull();
  });

  it('falls back to known data fields when there is no deeplink', () => {
    expect(webHrefForNotification({ data: { invoiceId: 'inv_1' } })).toBe('/billing/inv_1');
  });

  it('returns null when nothing matches', () => {
    expect(webHrefForNotification({ data: {} })).toBeNull();
  });
});
