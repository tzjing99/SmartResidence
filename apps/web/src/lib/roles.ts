import type { RoleId } from '@smartresidence/shared-types';

/**
 * The three UI "areas" of the web app. Each maps to a shell + route group:
 *  - `resident` → (resident) group, AppShell
 *  - `admin`    → /admin,         AdminShell
 *  - `guard`    → /guard,         GuardShell (minimal verification view)
 */
export type Area = 'resident' | 'admin' | 'guard';

/** A single serialized CASL rule as returned by `/api/auth/me`. */
export interface AbilityRule {
  action: string | string[];
  subject: string | string[];
  inverted?: boolean;
  conditions?: unknown;
  fields?: string[];
}

export interface MeUser {
  id: string;
  email: string | null;
  name: string;
  activeRole: RoleId | null;
  roles: Array<{ roleId: RoleId; condoId: string | null; unitId: string | null }>;
}

/** Shape of the `/api/auth/me` payload the web app actually relies on. */
export interface MeResponse {
  user: MeUser;
  abilities: AbilityRule[];
}

const MANAGEMENT_ROLES: RoleId[] = ['SUPER_ADMIN', 'MANAGEMENT_ADMIN', 'MANAGEMENT_STAFF'];
const RESIDENT_ROLES: RoleId[] = ['UNIT_OWNER', 'TENANT', 'HOUSEHOLD_MEMBER'];

export function isManagementRole(role: RoleId | null | undefined): boolean {
  return Boolean(role && MANAGEMENT_ROLES.includes(role));
}

export function isResidentRole(role: RoleId | null | undefined): boolean {
  return Boolean(role && RESIDENT_ROLES.includes(role));
}

export function isGuardRole(role: RoleId | null | undefined): boolean {
  return role === 'SECURITY_GUARD';
}

export function isPlatformRole(role: RoleId | null | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

/** Which UI area a role belongs to. CONTRACTOR/unknown fall back to resident. */
export function areaForRole(role: RoleId | null | undefined): Area {
  if (isGuardRole(role)) return 'guard';
  if (isManagementRole(role)) return 'admin';
  return 'resident';
}

/** The landing route for a role after sign-in (or when redirected out of a forbidden area). */
export function roleToHome(role: RoleId | null | undefined): string {
  if (isPlatformRole(role)) return '/admin/platform';
  switch (areaForRole(role)) {
    case 'guard':
      return '/guard';
    case 'admin':
      return '/admin';
    default:
      return '/dashboard';
  }
}

/** Whether a role is allowed to view a given area's pages. */
export function areaAllows(area: Area, role: RoleId | null | undefined): boolean {
  return areaForRole(role) === area;
}

/**
 * Lightweight client-side ability check against the serialized rules from
 * `/api/auth/me`. This intentionally ignores `conditions` (row scoping) — it
 * answers "could this role ever perform action on subject", which is exactly
 * what we need to decide whether to render a nav link or action button. The
 * API still enforces the full conditional CASL rules on every request.
 */
export function hasAbility(
  abilities: AbilityRule[] | undefined,
  action: string,
  subject: string,
): boolean {
  if (!Array.isArray(abilities)) return false;
  return abilities.some((rule) => {
    if (rule.inverted) return false;
    const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
    const subjects = Array.isArray(rule.subject) ? rule.subject : [rule.subject];
    const actionOk = actions.includes('manage') || actions.includes(action);
    const subjectOk = subjects.includes('all') || subjects.includes(subject);
    return actionOk && subjectOk;
  });
}
