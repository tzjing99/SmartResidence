import { describe, expect, it } from 'vitest';
import {
  CreateVisitorSchema,
  CreateWalkInOfficeSchema,
  CreateWalkInUnitSchema,
  guardCanAcknowledgeWalkIn,
  guardCanCheckOutVisitor,
  guardVisitorStatusLabel,
  isWalkInVisitType,
  showOvernightPreRegOption,
  visitorStatusLabel,
  visitorStatusPillTone,
} from './visitor';

describe('visitorStatusPillTone', () => {
  it('maps statuses to semantic pill tones', () => {
    expect(visitorStatusPillTone('APPROVED')).toBe('success');
    expect(visitorStatusPillTone('CHECKED_IN')).toBe('success');
    expect(visitorStatusPillTone('CHECKED_OUT')).toBe('neutral');
    expect(visitorStatusPillTone('EXPIRED')).toBe('neutral');
    expect(visitorStatusPillTone('PENDING_OWNER_APPROVAL')).toBe('warning');
    expect(visitorStatusPillTone('PENDING_MANAGEMENT_APPROVAL')).toBe('warning');
    expect(visitorStatusPillTone('REJECTED')).toBe('danger');
    expect(visitorStatusPillTone('CANCELLED')).toBe('danger');
  });
});

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

describe('guardVisitorStatusLabel', () => {
  it('uses guard-facing wording for gate duty screens', () => {
    expect(guardVisitorStatusLabel('PENDING_OWNER_APPROVAL')).toBe('Waiting for owner approval');
    expect(guardVisitorStatusLabel('PENDING_MANAGEMENT_APPROVAL')).toBe('Pending management');
    expect(guardVisitorStatusLabel('CHECKED_IN')).toBe('On site');
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

describe('walk-in business rules helpers', () => {
  it('identifies walk-in visit types', () => {
    expect(isWalkInVisitType('WALKIN_UNIT')).toBe(true);
    expect(isWalkInVisitType('PRE_REG')).toBe(false);
  });

  it('blocks guard checkout for walk-ins', () => {
    expect(guardCanCheckOutVisitor({ visitType: 'WALKIN_UNIT' })).toBe(false);
    expect(guardCanCheckOutVisitor({ visitType: 'PRE_REG' })).toBe(true);
  });

  it('allows acknowledge only for owner-approved unit walk-ins', () => {
    expect(guardCanAcknowledgeWalkIn({ visitType: 'WALKIN_UNIT', status: 'APPROVED' })).toBe(true);
    expect(
      guardCanAcknowledgeWalkIn({ visitType: 'WALKIN_UNIT', status: 'PENDING_OWNER_APPROVAL' }),
    ).toBe(false);
  });

  it('hides overnight pre-reg for walk-in entry mode', () => {
    expect(showOvernightPreRegOption('WALK_IN')).toBe(false);
    expect(showOvernightPreRegOption('DRIVE_IN')).toBe(true);
  });

  it('rejects overnight on walk-in entry mode in pre-reg schema', () => {
    const result = CreateVisitorSchema.safeParse({
      unitId: '11111111-1111-1111-1111-111111111111',
      name: 'Guest',
      phone: '+60123456789',
      expectedAt: new Date(Date.now() + 86_400_000),
      entryMode: 'WALK_IN',
      overnight: true,
    });
    expect(result.success).toBe(false);
  });
});
