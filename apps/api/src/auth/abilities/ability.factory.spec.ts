import type { AuthenticatedUser } from '@/common/types/request-context';
import { subject } from '@casl/ability';
import { RoleId } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AbilityFactory } from './ability.factory';

const factory = new AbilityFactory();

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'u-1',
    email: 'a@b.c',
    name: 'Test User',
    locale: 'en',
    activeCondoId: 'condo-1',
    activeRole: RoleId.UNIT_OWNER,
    roles: [],
    ...overrides,
  };
}

describe('AbilityFactory', () => {
  it('grants SUPER_ADMIN unconditional management', () => {
    const ability = factory.build(
      user({
        activeRole: RoleId.SUPER_ADMIN,
        roles: [{ roleId: RoleId.SUPER_ADMIN, condoId: null, unitId: null, permissions: [] }],
      }),
    );
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('read', 'Platform')).toBe(true);
    expect(ability.can('read', 'AuditLog')).toBe(true);
  });

  it('does not grant Platform access to management admin', () => {
    const ability = factory.build(
      user({
        roles: [
          { roleId: RoleId.MANAGEMENT_ADMIN, condoId: 'condo-1', unitId: null, permissions: [] },
        ],
        activeRole: RoleId.MANAGEMENT_ADMIN,
      }),
    );
    expect(ability.can('read', 'Platform')).toBe(false);
  });

  it('lets a unit owner read the audit log of their own unit only', () => {
    const ability = factory.build(
      user({
        roles: [
          { roleId: RoleId.UNIT_OWNER, condoId: 'condo-1', unitId: 'unit-1', permissions: [] },
        ],
      }),
    );
    expect(ability.can('read', 'AuditLog')).toBe(true);
    expect(ability.can('create', 'Visitor')).toBe(true);
    expect(ability.can('approve', 'Visitor')).toBe(true);
    // Never grant blanket `manage Visitor` — that implies gate ops.
    expect(ability.can('manage', 'Visitor')).toBe(false);
    expect(ability.can('check-in', 'Visitor')).toBe(false);
    expect(ability.can('create-walk-in', 'Visitor')).toBe(false);
  });

  it('does not let a security guard read invoices', () => {
    const ability = factory.build(
      user({
        roles: [
          { roleId: RoleId.SECURITY_GUARD, condoId: 'condo-1', unitId: null, permissions: [] },
        ],
        activeRole: RoleId.SECURITY_GUARD,
      }),
    );
    expect(ability.can('check-in', 'Visitor')).toBe(true);
    expect(ability.can('create-walk-in', 'Visitor')).toBe(true);
    expect(ability.can('approve', 'Visitor')).toBe(false);
    expect(ability.can('reject', 'Visitor')).toBe(false);
    expect(ability.can('verify', 'FormSubmission')).toBe(true);
    expect(ability.can('read', subject('Unit', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('read', 'Invoice')).toBe(false);
    expect(ability.can('manage', 'Defect')).toBe(false);
  });

  it('lets management read the visitor log but not approve or reject visitors', () => {
    const ability = factory.build(
      user({
        roles: [
          { roleId: RoleId.MANAGEMENT_ADMIN, condoId: 'condo-1', unitId: null, permissions: [] },
        ],
        activeRole: RoleId.MANAGEMENT_ADMIN,
      }),
    );
    expect(ability.can('read', subject('Visitor', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('approve', 'Visitor')).toBe(false);
    expect(ability.can('approve', subject('Visitor', { condoId: 'condo-1' }))).toBe(false);
    expect(ability.can('approve-overnight', subject('Visitor', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('reject', 'Visitor')).toBe(false);
    expect(ability.can('create', subject('Visitor', { condoId: 'condo-1' }))).toBe(false);
    expect(ability.can('check-in', 'Visitor')).toBe(false);
    expect(ability.can('create-walk-in', 'Visitor')).toBe(false);
  });

  it('lets management staff read the visitor log but not overnight-approve or gate-operate', () => {
    const ability = factory.build(
      user({
        roles: [
          { roleId: RoleId.MANAGEMENT_STAFF, condoId: 'condo-1', unitId: null, permissions: [] },
        ],
        activeRole: RoleId.MANAGEMENT_STAFF,
      }),
    );
    expect(ability.can('read', subject('Visitor', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('approve', 'Visitor')).toBe(false);
    expect(ability.can('reject', 'Visitor')).toBe(false);
    expect(ability.can('approve-overnight', 'Visitor')).toBe(false);
    expect(ability.can('manage-overnight-policy', 'Visitor')).toBe(false);
    expect(ability.can('check-in', 'Visitor')).toBe(false);
    expect(ability.can('create-walk-in', 'Visitor')).toBe(false);
  });
  it('lets management admin manage handover config but staff only read it', () => {
    const admin = factory.build(
      user({
        roles: [
          { roleId: RoleId.MANAGEMENT_ADMIN, condoId: 'condo-1', unitId: null, permissions: [] },
        ],
        activeRole: RoleId.MANAGEMENT_ADMIN,
      }),
    );
    expect(admin.can('manage', subject('UnitType', { condoId: 'condo-1' }))).toBe(true);
    expect(admin.can('manage', subject('DefectTaxonomy', { condoId: 'condo-1' }))).toBe(true);

    const staff = factory.build(
      user({
        roles: [
          { roleId: RoleId.MANAGEMENT_STAFF, condoId: 'condo-1', unitId: null, permissions: [] },
        ],
        activeRole: RoleId.MANAGEMENT_STAFF,
      }),
    );
    expect(staff.can('read', subject('UnitType', { condoId: 'condo-1' }))).toBe(true);
    expect(staff.can('read', subject('DefectTaxonomy', { condoId: 'condo-1' }))).toBe(true);
    expect(staff.can('manage', 'UnitType')).toBe(false);
    expect(staff.can('manage', 'DefectTaxonomy')).toBe(false);
    expect(staff.can('read', subject('DefectReport', { condoId: 'condo-1' }))).toBe(true);
    expect(staff.can('update', subject('DefectReport', { condoId: 'condo-1' }))).toBe(true);
  });

  it('lets a resident create defect reports for their own unit only', () => {
    const ability = factory.build(
      user({
        roles: [
          { roleId: RoleId.UNIT_OWNER, condoId: 'condo-1', unitId: 'unit-1', permissions: [] },
        ],
      }),
    );
    expect(ability.can('create', subject('DefectReport', { unitId: 'unit-1' }))).toBe(true);
    expect(ability.can('manage', subject('DefectReport', { unitId: 'unit-2' }))).toBe(false);
    expect(ability.can('manage', 'UnitType')).toBe(false);
  });

  it('lets residents delete their own account (PDPA erasure)', () => {
    const ability = factory.build(
      user({
        id: 'owner-1',
        roles: [
          { roleId: RoleId.UNIT_OWNER, condoId: 'condo-1', unitId: 'unit-1', permissions: [] },
        ],
      }),
    );
    expect(ability.can('delete', 'User')).toBe(true);
    expect(ability.can('export', 'User')).toBe(true);
  });

  it('lets a unit owner approve and reject visitors for their own unit', () => {
    const ability = factory.build(
      user({
        roles: [
          { roleId: RoleId.UNIT_OWNER, condoId: 'condo-1', unitId: 'unit-1', permissions: [] },
        ],
      }),
    );
    expect(ability.can('approve', subject('Visitor', { unitId: 'unit-1' }))).toBe(true);
    expect(ability.can('reject', subject('Visitor', { unitId: 'unit-1' }))).toBe(true);
    expect(ability.can('delete', subject('Visitor', { unitId: 'unit-1' }))).toBe(true);
    expect(ability.can('approve', subject('Visitor', { unitId: 'unit-2' }))).toBe(false);
    expect(ability.can('check-in', subject('Visitor', { unitId: 'unit-1' }))).toBe(false);
    expect(ability.can('create-walk-in', subject('Visitor', { condoId: 'condo-1' }))).toBe(false);
  });

  it('does not let household members approve or reject walk-ins', () => {
    const ability = factory.build(
      user({
        roles: [
          {
            roleId: RoleId.HOUSEHOLD_MEMBER,
            condoId: 'condo-1',
            unitId: 'unit-1',
            permissions: [],
          },
        ],
        activeRole: RoleId.HOUSEHOLD_MEMBER,
      }),
    );
    expect(ability.can('create', subject('Visitor', { unitId: 'unit-1' }))).toBe(true);
    expect(ability.can('read', subject('Visitor', { unitId: 'unit-1' }))).toBe(true);
    expect(ability.can('delete', subject('Visitor', { unitId: 'unit-1' }))).toBe(true);
    expect(ability.can('approve', subject('Visitor', { unitId: 'unit-1' }))).toBe(false);
    expect(ability.can('reject', subject('Visitor', { unitId: 'unit-1' }))).toBe(false);
    expect(ability.can('check-in', 'Visitor')).toBe(false);
  });

  it('lets a dual management+guard user keep gate ops while denying unit approve', () => {
    const ability = factory.build(
      user({
        roles: [
          { roleId: RoleId.MANAGEMENT_ADMIN, condoId: 'condo-1', unitId: null, permissions: [] },
          { roleId: RoleId.SECURITY_GUARD, condoId: 'condo-1', unitId: null, permissions: [] },
        ],
        activeRole: RoleId.SECURITY_GUARD,
      }),
    );
    expect(ability.can('check-in', subject('Visitor', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('create-walk-in', subject('Visitor', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('approve', 'Visitor')).toBe(false);
    expect(ability.can('reject', 'Visitor')).toBe(false);
  });
  it('lets residents create and resolve their own lost & found posts', () => {
    const ability = factory.build(
      user({
        id: 'owner-1',
        roles: [
          { roleId: RoleId.UNIT_OWNER, condoId: 'condo-1', unitId: 'unit-1', permissions: [] },
        ],
      }),
    );
    expect(ability.can('create', subject('LostFoundPost', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('resolve', subject('LostFoundPost', { userId: 'owner-1' }))).toBe(true);
    expect(ability.can('manage', subject('LostFoundPost', { condoId: 'condo-1' }))).toBe(false);
  });

  it('lets management manage governance meetings and documents', () => {
    const ability = factory.build(
      user({
        roles: [
          { roleId: RoleId.MANAGEMENT_ADMIN, condoId: 'condo-1', unitId: null, permissions: [] },
        ],
        activeRole: RoleId.MANAGEMENT_ADMIN,
      }),
    );
    expect(ability.can('manage', subject('GeneralMeeting', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('manage', subject('Document', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('manage', subject('VendorBill', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('export', subject('VendorBill', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('read', 'Platform')).toBe(false);
  });

  it('denies residents access to vendor bills (no marketplace)', () => {
    const ability = factory.build(
      user({
        roles: [
          { roleId: RoleId.UNIT_OWNER, condoId: 'condo-1', unitId: 'unit-1', permissions: [] },
        ],
      }),
    );
    expect(ability.can('read', subject('VendorBill', { condoId: 'condo-1' }))).toBe(false);
    expect(ability.can('read', subject('Vendor', { condoId: 'condo-1' }))).toBe(false);
  });

  it('lets tenants read documents but not manage folders', () => {
    const ability = factory.build(
      user({
        roles: [{ roleId: RoleId.TENANT, condoId: 'condo-1', unitId: 'unit-1', permissions: [] }],
        activeRole: RoleId.TENANT,
      }),
    );
    expect(ability.can('read', subject('Document', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('manage', subject('DocumentFolder', { condoId: 'condo-1' }))).toBe(false);
  });
});
