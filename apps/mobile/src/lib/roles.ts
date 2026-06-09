import type { RoleId } from '@smartresidence/shared-types';
import type { Href } from 'expo-router';

/** Mobile route groups mirror the web app's resident / management / guard areas. */
export type MobileArea = 'resident' | 'management' | 'guard';

export interface MeUser {
  id: string;
  email: string | null;
  name: string;
  activeRole: RoleId | null;
  roles: Array<{ roleId: RoleId; condoId: string | null; unitId: string | null }>;
}

/** Shape of `/api/auth/me` used for post-login routing and area guards. */
export interface MeResponse {
  user: MeUser;
  abilities: unknown[];
}

const MANAGEMENT_ROLES: RoleId[] = ['SUPER_ADMIN', 'MANAGEMENT_ADMIN', 'MANAGEMENT_STAFF'];

export function getActiveRole(me: unknown): RoleId | null {
  return (me as MeResponse | undefined)?.user?.activeRole ?? null;
}

export function areaForRole(role: RoleId | null | undefined): MobileArea {
  if (role === 'SECURITY_GUARD') return 'guard';
  if (role && MANAGEMENT_ROLES.includes(role)) return 'management';
  return 'resident';
}

/** Landing route after sign-in or when bounced out of a forbidden area. */
export function roleToHomePath(role: RoleId | null | undefined): Href {
  switch (areaForRole(role)) {
    case 'guard':
      return '/(guard)/scan';
    case 'management':
      return '/(management)/settings';
    default:
      return '/(resident)/home';
  }
}

export function areaAllows(area: MobileArea, role: RoleId | null | undefined): boolean {
  return areaForRole(role) === area;
}
