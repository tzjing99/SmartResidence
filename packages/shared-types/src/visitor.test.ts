import { describe, expect, it } from 'vitest';
import { CreateWalkInOfficeSchema, CreateWalkInUnitSchema, visitorStatusLabel } from './visitor';

describe('visitorStatusLabel', () => {
  it('maps enums to plain language (no raw enums)', () => {
    expect(visitorStatusLabel('PENDING_OWNER_APPROVAL')).toBe('Waiting for your approval');
    expect(visitorStatusLabel('CHECKED_IN')).toBe('On site');
    expect(visitorStatusLabel('CHECKED_OUT')).toBe('Visited');
    expect(visitorStatusLabel('REJECTED')).toBe('Declined');
  });

  it('falls back to a humanized label for unknown statuses', () => {
    expect(visitorStatusLabel('SOME_NEW_STATUS')).toBe('some new status');
  });
});

describe('guard walk-in schemas require phone', () => {
  it('rejects a unit walk-in with no phone', () => {
    const result = CreateWalkInUnitSchema.safeParse({
      unitId: '11111111-1111-1111-1111-111111111111',
      name: 'Bob Tan',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a unit walk-in with a valid Malaysia phone', () => {
    const result = CreateWalkInUnitSchema.safeParse({
      unitId: '11111111-1111-1111-1111-111111111111',
      name: 'Bob Tan',
      phone: '012-345 6789',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe('+60123456789');
  });

  it('rejects an office walk-in with no phone', () => {
    const result = CreateWalkInOfficeSchema.safeParse({
      name: 'Courier',
      purpose: 'Parcel drop',
    });
    expect(result.success).toBe(false);
  });
});
