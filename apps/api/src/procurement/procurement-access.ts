import type { AuthenticatedUser } from '@/common/types/request-context';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoleId } from '@prisma/client';

const MANAGEMENT_ROLES: RoleId[] = [
  RoleId.SUPER_ADMIN,
  RoleId.MANAGEMENT_ADMIN,
  RoleId.MANAGEMENT_STAFF,
];

export function assertManagement(user: AuthenticatedUser, condoId: string): void {
  if (!isManagement(user, condoId)) {
    throw new ForbiddenException('Management access required');
  }
}

export function isManagement(user: AuthenticatedUser, condoId: string): boolean {
  return user.roles.some(
    (r) =>
      MANAGEMENT_ROLES.includes(r.roleId) &&
      (r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId),
  );
}

export function isManagementAdmin(user: AuthenticatedUser, condoId: string): boolean {
  return user.roles.some(
    (r) =>
      (r.roleId === RoleId.SUPER_ADMIN || r.roleId === RoleId.MANAGEMENT_ADMIN) &&
      (r.roleId === RoleId.SUPER_ADMIN || r.condoId === condoId),
  );
}

export const ALLOWED_VENDOR_BILL_FUNDS = ['MAINTENANCE', 'SINKING_FUND', 'GENERAL'] as const;

export function assertVendorBillFund(fund: string): void {
  if (!(ALLOWED_VENDOR_BILL_FUNDS as readonly string[]).includes(fund)) {
    throw new BadRequestException('Invalid fund for vendor bill');
  }
}
