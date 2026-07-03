import { isManagementForCondo } from '@/announcement/announcement-audience';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { ForbiddenException } from '@nestjs/common';
import { RoleId } from '@prisma/client';

/**
 * `@CheckAbility` only proves a user manages *some* condo — CASL isn't handed
 * the `:condoId` route param, so it can't tell "this" condo from any other.
 * Every condo-scoped management route/service method must additionally call
 * this (or an equivalent check) before reading/writing data for the condoId
 * in the URL, otherwise a MANAGEMENT_ADMIN of condo A could read/mutate condo
 * B's data by swapping the path segment (cross-tenant IDOR).
 */
export function assertCondoManagement(user: AuthenticatedUser, condoId: string): void {
  const isSuperAdmin = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN);
  if (isSuperAdmin || isManagementForCondo(user, condoId)) return;
  throw new ForbiddenException('Management access required for this condo');
}

/** Same as {@link assertCondoManagement} but also allows any member (resident/guard/staff) of the condo. */
export function assertCondoMember(user: AuthenticatedUser, condoId: string): void {
  const allowed = user.roles.some((r) => r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId);
  if (!allowed) throw new ForbiddenException('You do not have access to this condo');
}
