import { describe, expect, it } from 'vitest';
import { announcementStatus } from '@smartresidence/shared-types';

const NOW = new Date('2026-06-23T12:00:00.000Z');

describe('announcementStatus', () => {
  it('is DRAFT when not published', () => {
    expect(announcementStatus({ publishedAt: null }, NOW)).toBe('DRAFT');
    expect(announcementStatus({ publishedAt: undefined }, NOW)).toBe('DRAFT');
  });

  it('is SCHEDULED when publish time is in the future', () => {
    const future = new Date(NOW.getTime() + 60 * 60_000);
    expect(announcementStatus({ publishedAt: future }, NOW)).toBe('SCHEDULED');
  });

  it('is PUBLISHED when live and not expired', () => {
    const past = new Date(NOW.getTime() - 60 * 60_000);
    expect(announcementStatus({ publishedAt: past }, NOW)).toBe('PUBLISHED');
    const future = new Date(NOW.getTime() + 60 * 60_000);
    expect(announcementStatus({ publishedAt: past, expiresAt: future }, NOW)).toBe('PUBLISHED');
  });

  it('is EXPIRED once the expiry time has passed', () => {
    const past = new Date(NOW.getTime() - 2 * 60 * 60_000);
    const expired = new Date(NOW.getTime() - 60 * 60_000);
    expect(announcementStatus({ publishedAt: past, expiresAt: expired }, NOW)).toBe('EXPIRED');
  });

  it('treats an exact-now publish time as live (boundary)', () => {
    expect(announcementStatus({ publishedAt: NOW }, NOW)).toBe('PUBLISHED');
  });

  it('accepts ISO date strings', () => {
    expect(announcementStatus({ publishedAt: '2026-06-23T11:00:00.000Z' }, NOW)).toBe('PUBLISHED');
  });
});
