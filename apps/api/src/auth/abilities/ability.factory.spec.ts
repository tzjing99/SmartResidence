import type { AuthenticatedUser } from '@/common/types/request-context';
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
    expect(ability.can('read', 'Invoice')).toBe(false);
    expect(ability.can('manage', 'Defect')).toBe(false);
  });
});
