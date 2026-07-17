import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACCESS_RESTRICTION_SETTINGS,
  mergeAccessRestrictionSettings,
  parseAccessRestrictionSettings,
  toPublicAccessRestrictionSettings,
} from './access-restriction-settings';

describe('access-restriction-settings', () => {
  it('returns defaults for empty condo settings', () => {
    const parsed = parseAccessRestrictionSettings({});
    expect(parsed.enabled).toBe(false);
    expect(parsed.graceDays).toBe(14);
    expect(parsed.zones).toEqual(['CAR_PARK', 'AMENITIES']);
  });

  it('hides webhook secret on public view', () => {
    const publicView = toPublicAccessRestrictionSettings({
      ...DEFAULT_ACCESS_RESTRICTION_SETTINGS,
      webhookSecret: 'super-secret',
      webhookUrl: 'https://example.com/hook',
    });
    expect(publicView.hasWebhookSecret).toBe(true);
    expect(publicView).not.toHaveProperty('webhookSecret');
  });

  it('merges into condo.settings.accessRestriction', () => {
    const next = mergeAccessRestrictionSettings(
      { visitor: { overnightSlotsPerNight: 3 } },
      { ...DEFAULT_ACCESS_RESTRICTION_SETTINGS, enabled: true, graceDays: 21 },
    );
    expect(next.visitor).toEqual({ overnightSlotsPerNight: 3 });
    expect((next.accessRestriction as { enabled: boolean; graceDays: number }).enabled).toBe(true);
    expect((next.accessRestriction as { graceDays: number }).graceDays).toBe(21);
  });
});
