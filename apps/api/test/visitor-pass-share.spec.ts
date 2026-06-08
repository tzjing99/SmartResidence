import {
  formatVisitorPassShareText,
  formatVisitorPassShareTitle,
} from '@smartresidence/shared-types';
import { describe, expect, it } from 'vitest';

describe('visitor pass share text', () => {
  it('formats a plain-language share title', () => {
    expect(formatVisitorPassShareTitle('Jane Doe')).toBe('Visitor pass — Jane Doe');
  });

  it('includes access code, validity window, and unit', () => {
    const text = formatVisitorPassShareText({
      visitorName: 'Jane Doe',
      accessCode: 'K7M3P9',
      expectedAt: new Date('2026-06-10T10:00:00'),
      expiresAt: new Date('2026-06-10T14:00:00'),
      unitIdentifier: 'A-12-03',
    });
    expect(text).toContain('Access code: K7M3P9');
    expect(text).toContain('Unit: A-12-03');
    expect(text).toContain('guardhouse');
    expect(text).toMatch(/Valid:/);
  });
});
