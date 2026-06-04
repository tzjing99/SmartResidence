import { z } from 'zod';

export const RoleId = z.enum([
  'SUPER_ADMIN',
  'MANAGEMENT_ADMIN',
  'MANAGEMENT_STAFF',
  'SECURITY_GUARD',
  'UNIT_OWNER',
  'TENANT',
  'HOUSEHOLD_MEMBER',
  'CONTRACTOR',
]);
export type RoleId = z.infer<typeof RoleId>;

export const RoleScope = z.enum(['PLATFORM', 'CONDO', 'UNIT']);
export type RoleScope = z.infer<typeof RoleScope>;

/**
 * Public role priority — higher means more privileged. Mirrors the API's
 * internal priority map so clients can pick the most capable role for a UI.
 */
export const ROLE_PRIORITY: Record<RoleId, number> = {
  SUPER_ADMIN: 100,
  MANAGEMENT_ADMIN: 80,
  MANAGEMENT_STAFF: 70,
  SECURITY_GUARD: 60,
  UNIT_OWNER: 50,
  TENANT: 40,
  HOUSEHOLD_MEMBER: 30,
  CONTRACTOR: 20,
};

export const ROLE_LABEL: Record<RoleId, string> = {
  SUPER_ADMIN: 'Platform admin',
  MANAGEMENT_ADMIN: 'Management admin',
  MANAGEMENT_STAFF: 'Management staff',
  SECURITY_GUARD: 'Security guard',
  UNIT_OWNER: 'Unit owner',
  TENANT: 'Tenant',
  HOUSEHOLD_MEMBER: 'Household member',
  CONTRACTOR: 'Contractor',
};
