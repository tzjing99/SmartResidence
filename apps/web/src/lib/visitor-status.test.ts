import { describe, expect, it } from 'vitest';
import { visitorStatusLabelKey, visitorStatusTone } from './visitor-status';

describe('visitorStatusTone', () => {
  it('maps each status to the unified palette tone', () => {
    expect(visitorStatusTone('CHECKED_IN')).toBe('success');
    expect(visitorStatusTone('CHECKED_OUT')).toBe('neutral');
    expect(visitorStatusTone('PENDING_OWNER_APPROVAL')).toBe('warning');
    expect(visitorStatusTone('PENDING_MANAGEMENT_APPROVAL')).toBe('warning');
    expect(visitorStatusTone('REJECTED')).toBe('danger');
    expect(visitorStatusTone('EXPIRED')).toBe('danger');
    expect(visitorStatusTone('CANCELLED')).toBe('danger');
    expect(visitorStatusTone('APPROVED')).toBe('primary');
  });
});

describe('visitorStatusLabelKey', () => {
  it('builds the i18n key for a status (never a raw enum)', () => {
    expect(visitorStatusLabelKey('PENDING_OWNER_APPROVAL')).toBe(
      'visitors.statusLabel.PENDING_OWNER_APPROVAL',
    );
  });
});
