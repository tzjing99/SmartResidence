import { visitorToCreateInput } from '@smartresidence/shared-types';
import { describe, expect, it } from 'vitest';

describe('visitorToCreateInput', () => {
  it('builds create input with edited expectedAt for invite again', () => {
    const past = {
      id: 'v1',
      condoId: 'c1',
      visitType: 'PRE_REG' as const,
      unitId: 'u1',
      name: 'Ali',
      phone: '0123456789',
      phoneCountryCode: '+60',
      vehiclePlate: 'ABC1234',
      purpose: 'VISITOR',
      overnight: false,
      expectedAt: new Date('2025-01-01T10:00:00Z'),
      status: 'CHECKED_OUT' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const expectedAt = new Date('2026-06-10T18:00:00');
    const input = visitorToCreateInput(past, 'u1', expectedAt);
    expect(input.name).toBe('Ali');
    expect(input.phone).toBe('0123456789');
    expect(input.vehiclePlate).toBe('ABC1234');
    expect(input.entryMode).toBe('DRIVE_IN');
    expect(input.expectedAt).toEqual(expectedAt);
    expect(input.overnight).toBe(false);
  });
});
