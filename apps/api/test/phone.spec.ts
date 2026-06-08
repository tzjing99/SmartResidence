import {
  CreateVisitorSchema,
  CreateWalkInUnitSchema,
  formatMalaysiaPhoneDisplay,
  isValidMalaysiaPhone,
  malaysiaPhoneTelHref,
  normalizeMalaysiaPhone,
  pickOwnerPhone,
  resolveMalaysiaPhoneE164,
} from '@smartresidence/shared-types';
import { describe, expect, it } from 'vitest';

describe('phone utilities', () => {
  it('normalizes common Malaysia formats to E.164', () => {
    expect(normalizeMalaysiaPhone('012-345 6789')).toBe('+60123456789');
    expect(normalizeMalaysiaPhone('60123456789')).toBe('+60123456789');
    expect(normalizeMalaysiaPhone('+60123456789')).toBe('+60123456789');
    expect(normalizeMalaysiaPhone('134250927')).toBe('+60134250927');
    expect(normalizeMalaysiaPhone('0134250927')).toBe('+60134250927');
  });

  it('resolves legacy stored phone with country code to E.164', () => {
    expect(resolveMalaysiaPhoneE164('134250927', '+60')).toBe('+60134250927');
    expect(resolveMalaysiaPhoneE164('123456789', '+60')).toBe('+60123456789');
    expect(resolveMalaysiaPhoneE164('+60134250927')).toBe('+60134250927');
  });

  it('formats display and tel href for guard UI', () => {
    expect(formatMalaysiaPhoneDisplay('134250927', '+60')).toBe('+60134250927');
    expect(malaysiaPhoneTelHref('134250927', '+60')).toBe('tel:+60134250927');
    expect(malaysiaPhoneTelHref('12345')).toBeNull();
  });

  it('normalizes pre-reg visitor phone via CreateVisitorSchema', () => {
    const parsed = CreateVisitorSchema.parse({
      unitId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Mei Lin',
      phone: '0134250927',
      vehiclePlate: 'WSC 1234',
      expectedAt: new Date('2026-06-10T10:00:00Z'),
    });
    expect(parsed.phone).toBe('+60134250927');
  });

  it('validates normalized Malaysia mobile numbers', () => {
    expect(isValidMalaysiaPhone('0123456789')).toBe(true);
    expect(isValidMalaysiaPhone('+60111222333')).toBe(true);
    expect(isValidMalaysiaPhone('12345')).toBe(false);
    expect(isValidMalaysiaPhone('+6591234567')).toBe(false);
  });

  it('requires phone for guard walk-in and normalizes when provided', () => {
    expect(
      CreateWalkInUnitSchema.safeParse({
        unitId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Bob',
      }).success,
    ).toBe(false);
    const parsed = CreateWalkInUnitSchema.parse({
      unitId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Bob',
      phone: '012-345 6789',
    });
    expect(parsed.phone).toBe('+60123456789');
  });

  it('picks primary owner phone over secondary', () => {
    const picked = pickOwnerPhone([
      { id: '2', name: 'Secondary', phone: '+60111111111', isPrimary: false },
      { id: '1', name: 'Primary', phone: '+60222222222', isPrimary: true },
    ]);
    expect(picked?.id).toBe('1');
    expect(picked?.phone).toBe('+60222222222');
  });
});
