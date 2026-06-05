import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  AbilityBuilder,
  type AbilityClass,
  type ConditionsMatcher,
  type FieldMatcher,
  PureAbility,
  fieldPatternMatcher,
  mongoQueryMatcher,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { RoleId } from '@prisma/client';

/**
 * Subjects identify the resource kinds in the system. We intentionally use
 * plain strings (not Prisma classes) to keep the rule set serializable —
 * the same ruleset is shipped to clients (`/api/auth/me`) so the UI can hide
 * disallowed actions.
 */
export type Subject =
  | 'all'
  | 'Condo'
  | 'Block'
  | 'Unit'
  | 'Ownership'
  | 'Tenancy'
  | 'HouseholdMember'
  | 'Visitor'
  | 'VisitorCheckIn'
  | 'Invoice'
  | 'Payment'
  | 'Defect'
  | 'DefectUpdate'
  | 'Announcement'
  | 'AuditLog'
  | 'User'
  | 'RoleAssignment'
  | 'PushSubscription'
  | 'Notification';

export type Action =
  | 'manage'
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'check-in'
  | 'check-out'
  | 'pay'
  | 'publish'
  | 'acknowledge'
  | 'invite'
  | 'revoke'
  | 'export';

export type AppAbility = PureAbility<[Action, Subject]>;
const AppAbility = PureAbility as AbilityClass<AppAbility>;

@Injectable()
export class AbilityFactory {
  /**
   * Build the merged ability set for a user. Permissions from every active
   * role assignment are combined (union semantics). The owner-empowerment
   * principle is encoded here: a UNIT_OWNER can `read` AuditLog rows scoped
   * to their own unit, etc.
   *
   * Conditions/fields matchers must be supplied explicitly: as of
   * @casl/ability v6.8, PureAbility refuses to construct a rule that has
   * `conditions` without a `conditionsMatcher`, which would otherwise cause
   * `/api/auth/me` to 500 and bounce signed-in users back to /sign-in.
   */
  build(user: AuthenticatedUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(AppAbility);

    for (const r of user.roles) {
      this.applyRole(can, r.roleId, {
        userId: user.id,
        condoId: r.condoId,
        unitId: r.unitId,
      });
    }

    return build({
      conditionsMatcher: mongoQueryMatcher as ConditionsMatcher<unknown>,
      fieldMatcher: fieldPatternMatcher as FieldMatcher,
    });
  }

  private applyRole(
    can: AbilityBuilder<AppAbility>['can'],
    role: RoleId,
    scope: { userId: string; condoId: string | null; unitId: string | null },
  ): void {
    switch (role) {
      case RoleId.SUPER_ADMIN:
        can('manage', 'all');
        return;

      case RoleId.MANAGEMENT_ADMIN:
        can('manage', 'Condo', { id: scope.condoId ?? '' });
        can('manage', 'Block', { condoId: scope.condoId ?? '' });
        can('manage', 'Unit', { condoId: scope.condoId ?? '' });
        can('manage', 'Ownership');
        can('manage', 'Tenancy');
        can('manage', 'Visitor', { condoId: scope.condoId ?? '' });
        can('manage', 'Invoice', { condoId: scope.condoId ?? '' });
        can('manage', 'Payment');
        can('manage', 'Defect', { condoId: scope.condoId ?? '' });
        can('manage', 'Announcement', { condoId: scope.condoId ?? '' });
        can('manage', 'RoleAssignment', { condoId: scope.condoId ?? '' });
        can('read', 'AuditLog', { condoId: scope.condoId ?? '' });
        can('read', 'User');
        can('export', 'Invoice');
        return;

      case RoleId.MANAGEMENT_STAFF:
        can('read', 'Condo', { id: scope.condoId ?? '' });
        can('read', 'Unit', { condoId: scope.condoId ?? '' });
        can('read', 'Visitor', { condoId: scope.condoId ?? '' });
        can('approve', 'Visitor', { condoId: scope.condoId ?? '' });
        can('read', 'Defect', { condoId: scope.condoId ?? '' });
        can('update', 'Defect', { condoId: scope.condoId ?? '' });
        can('read', 'Invoice', { condoId: scope.condoId ?? '' });
        can('publish', 'Announcement', { condoId: scope.condoId ?? '' });
        return;

      case RoleId.SECURITY_GUARD:
        can('read', 'Visitor', { condoId: scope.condoId ?? '' });
        can('check-in', 'Visitor', { condoId: scope.condoId ?? '' });
        can('check-out', 'Visitor', { condoId: scope.condoId ?? '' });
        return;

      case RoleId.UNIT_OWNER:
        can('read', 'Condo', { id: scope.condoId ?? '' });
        can('read', 'Unit', { id: scope.unitId ?? '' });
        can('manage', 'Visitor', { unitId: scope.unitId ?? '' });
        can('read', 'Invoice', { unitId: scope.unitId ?? '' });
        can('pay', 'Invoice', { unitId: scope.unitId ?? '' });
        can('manage', 'Defect', { unitId: scope.unitId ?? '' });
        can('read', 'Announcement', { condoId: scope.condoId ?? '' });
        can('acknowledge', 'Announcement');
        can('manage', 'Tenancy', { unitId: scope.unitId ?? '' });
        can('manage', 'HouseholdMember', { unitId: scope.unitId ?? '' });
        can('invite', 'User');
        can('revoke', 'RoleAssignment', { unitId: scope.unitId ?? '' });
        // Owner empowerment: full read on own unit's audit log
        can('read', 'AuditLog', { unitId: scope.unitId ?? '' });
        can('read', 'User', { id: scope.userId });
        can('update', 'User', { id: scope.userId });
        return;

      case RoleId.TENANT:
        can('read', 'Condo', { id: scope.condoId ?? '' });
        can('read', 'Unit', { id: scope.unitId ?? '' });
        can('manage', 'Visitor', { unitId: scope.unitId ?? '' });
        can('read', 'Invoice', { unitId: scope.unitId ?? '' });
        can('manage', 'Defect', { unitId: scope.unitId ?? '' });
        can('read', 'Announcement', { condoId: scope.condoId ?? '' });
        can('acknowledge', 'Announcement');
        can('read', 'User', { id: scope.userId });
        can('update', 'User', { id: scope.userId });
        return;

      case RoleId.HOUSEHOLD_MEMBER:
        can('read', 'Unit', { id: scope.unitId ?? '' });
        can('create', 'Visitor', { unitId: scope.unitId ?? '' });
        can('read', 'Visitor', { unitId: scope.unitId ?? '' });
        can('read', 'Announcement', { condoId: scope.condoId ?? '' });
        can('read', 'User', { id: scope.userId });
        return;

      case RoleId.CONTRACTOR:
        can('read', 'Defect');
        can('update', 'Defect');
        return;
    }
  }

  /**
   * Serialize a user's ability bundle as plain rules so the client can
   * use the same library to determine UI affordances.
   */
  rulesFor(user: AuthenticatedUser): unknown[] {
    return this.build(user).rules;
  }
}
