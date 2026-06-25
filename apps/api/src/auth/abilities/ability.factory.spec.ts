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
    expect(ability.can('read', 'AuditLog')).toBe(true);
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
    expect(ability.can('manage', 'Visitor')).toBe(true);
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
    expect(ability.can('approve', subject('Visitor', { condoId: 'condo-1' }))).toBe(false);
    expect(ability.can('approve-overnight', subject('Visitor', { condoId: 'condo-1' }))).toBe(true);
    expect(ability.can('reject', subject('Visitor', { condoId: 'condo-1' }))).toBe(false);
    expect(ability.can('create', subject('Visitor', { condoId: 'condo-1' }))).toBe(false);
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
    expect(ability.can('approve', subject('Visitor', { unitId: 'unit-2' }))).toBe(false);
  });
});
