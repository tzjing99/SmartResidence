import type { RoleId } from '@prisma/client';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  name: string;
  locale: string;
  /** All role assignments resolved at login. */
  roles: Array<{
    roleId: RoleId;
    condoId: string | null;
    unitId: string | null;
    permissions: string[];
  }>;
  /** Currently selected condo for this request (set by tenant-context middleware). */
  activeCondoId: string | null;
  /** The single highest-priority role for the active condo. */
  activeRole: RoleId | null;
}

export interface RequestContext {
  requestId: string;
  user: AuthenticatedUser | null;
  ip: string | null;
  userAgent: string | null;
}

export type RequestWithContext = Request & {
  ctx: RequestContext;
};
