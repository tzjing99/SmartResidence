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
  | 'FavouriteVisitor'
  | 'VisitorBlacklist'
  | 'RecurringPass'
  | 'Invoice'
  | 'Payment'
  | 'Deposit'
  | 'Receipt'
  | 'BillingSettings'
  | 'EInvoice'
  | 'Ledger'
  | 'GeneralLedger'
  | 'Defect'
  | 'DefectUpdate'
  | 'DefectReport'
  | 'UnitType'
  | 'DefectTaxonomy'
  | 'Announcement'
  | 'Poll'
  | 'GeneralMeeting'
  | 'MeetingProxy'
  | 'MeetingResolution'
  | 'Facility'
  | 'Booking'
  | 'AuditLog'
  | 'User'
  | 'RoleAssignment'
  | 'PushSubscription'
  | 'Notification'
  | 'Thread'
  | 'ThreadMessage'
  | 'Faq'
  | 'SlaPolicy'
  | 'McpServer'
  | 'SosAlert'
  | 'PatrolCheckpoint'
  | 'PatrolScan'
  | 'Parcel'
  | 'FormTemplate'
  | 'FormSubmission'
  | 'DocumentFolder'
  | 'Document'
  | 'DocumentVersion'
  | 'LostFoundPost'
  | 'Vendor'
  | 'VendorBill'
  | 'Platform';

export type Action =
  | 'manage'
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'resolve'
  | 'approve'
  | 'approve-overnight'
  | 'manage-overnight-policy'
  | 'reject'
  | 'cancel'
  | 'check-in'
  | 'check-out'
  | 'create-walk-in'
  | 'pay'
  | 'publish'
  | 'acknowledge'
  | 'vote'
  | 'submit-proxy'
  | 'invite'
  | 'revoke'
  | 'export'
  | 'collect'
  | 'verify';

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
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(AppAbility);

    for (const r of user.roles) {
      this.applyRole(can, cannot, r.roleId, {
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
    cannot: AbilityBuilder<AppAbility>['cannot'],
    role: RoleId,
    scope: { userId: string; condoId: string | null; unitId: string | null },
  ): void {
    switch (role) {
      case RoleId.SUPER_ADMIN:
        can('manage', 'all');
        can('read', 'Platform');
        can('manage', 'Platform');
        return;

      case RoleId.MANAGEMENT_ADMIN:
        can('manage', 'Condo', { id: scope.condoId ?? '' });
        can('manage', 'Block', { condoId: scope.condoId ?? '' });
        can('manage', 'Unit', { condoId: scope.condoId ?? '' });
        can('manage', 'Ownership');
        can('manage', 'Tenancy');
        // Management is read/audit only on unit walk-ins: they can view and
        // export the log, but approving/rejecting unit visitors belongs to
        // residents. Overnight pre-reg review remains a management exception.
        can('read', 'Visitor', { condoId: scope.condoId ?? '' });
        can('export', 'Visitor', { condoId: scope.condoId ?? '' });
        can('approve-overnight', 'Visitor', { condoId: scope.condoId ?? '' });
        can('manage-overnight-policy', 'Visitor', { condoId: scope.condoId ?? '' });
        cannot('approve', 'Visitor');
        cannot('reject', 'Visitor');
        cannot('check-in', 'Visitor');
        cannot('check-out', 'Visitor');
        cannot('create-walk-in', 'Visitor');
        can('manage', 'VisitorBlacklist', { condoId: scope.condoId ?? '' });
        can('read', 'RecurringPass', { condoId: scope.condoId ?? '' });
        can('manage', 'Invoice', { condoId: scope.condoId ?? '' });
        can('manage', 'Payment', { condoId: scope.condoId ?? '' });
        can('manage', 'Deposit', { condoId: scope.condoId ?? '' });
        can('manage', 'Receipt', { condoId: scope.condoId ?? '' });
        can('manage', 'BillingSettings', { condoId: scope.condoId ?? '' });
        can('manage', 'EInvoice', { condoId: scope.condoId ?? '' });
        can('manage', 'Ledger', { condoId: scope.condoId ?? '' });
        can('manage', 'GeneralLedger', { condoId: scope.condoId ?? '' });
        can('manage', 'Defect', { condoId: scope.condoId ?? '' });
        can('manage', 'DefectReport', { condoId: scope.condoId ?? '' });
        // Handover config (unit types + defect taxonomy): admin-managed like FAQ.
        can('manage', 'UnitType', { condoId: scope.condoId ?? '' });
        can('manage', 'DefectTaxonomy', { condoId: scope.condoId ?? '' });
        can('manage', 'Announcement', { condoId: scope.condoId ?? '' });
        can('manage', 'Poll', { condoId: scope.condoId ?? '' });
        can('manage', 'GeneralMeeting', { condoId: scope.condoId ?? '' });
        can('manage', 'MeetingResolution', { condoId: scope.condoId ?? '' });
        can('read', 'MeetingProxy', { condoId: scope.condoId ?? '' });
        can('manage', 'Facility', { condoId: scope.condoId ?? '' });
        can('manage', 'Booking', { condoId: scope.condoId ?? '' });
        can('manage', 'RoleAssignment', { condoId: scope.condoId ?? '' });
        can('manage', 'Thread', { condoId: scope.condoId ?? '' });
        // Resolution is resident-driven (D2): management proposes, never resolves.
        cannot('resolve', 'Thread');
        can('manage', 'ThreadMessage');
        can('manage', 'Faq', { condoId: scope.condoId ?? '' });
        can('manage', 'SlaPolicy', { condoId: scope.condoId ?? '' });
        can('manage', 'McpServer', { condoId: scope.condoId ?? '' });
        // Guard safety: management runs SOS response + patrol checkpoints.
        can('manage', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('manage', 'PatrolCheckpoint', { condoId: scope.condoId ?? '' });
        can('read', 'PatrolScan', { condoId: scope.condoId ?? '' });
        can('manage', 'Parcel', { condoId: scope.condoId ?? '' });
        can('manage', 'FormTemplate', { condoId: scope.condoId ?? '' });
        can('manage', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('verify', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('manage', 'DocumentFolder', { condoId: scope.condoId ?? '' });
        can('manage', 'Document', { condoId: scope.condoId ?? '' });
        can('manage', 'DocumentVersion', { condoId: scope.condoId ?? '' });
        can('manage', 'LostFoundPost', { condoId: scope.condoId ?? '' });
        can('manage', 'Vendor', { condoId: scope.condoId ?? '' });
        can('manage', 'VendorBill', { condoId: scope.condoId ?? '' });
        can('export', 'VendorBill', { condoId: scope.condoId ?? '' });
        can('manage', 'Notification', { condoId: scope.condoId ?? '' });
        can('read', 'AuditLog', { condoId: scope.condoId ?? '' });
        can('read', 'User');
        can('update', 'User');
        can('export', 'User', { id: scope.userId });
        can('delete', 'User', { id: scope.userId });
        can('export', 'Invoice', { condoId: scope.condoId ?? '' });
        return;

      case RoleId.MANAGEMENT_STAFF:
        can('read', 'Condo', { id: scope.condoId ?? '' });
        can('read', 'Unit', { condoId: scope.condoId ?? '' });
        can('read', 'Visitor', { condoId: scope.condoId ?? '' });
        // Staff: visitor log read-only (no overnight approve / gate / unit approve).
        cannot('approve', 'Visitor');
        cannot('reject', 'Visitor');
        cannot('approve-overnight', 'Visitor');
        cannot('manage-overnight-policy', 'Visitor');
        cannot('check-in', 'Visitor');
        cannot('check-out', 'Visitor');
        cannot('create-walk-in', 'Visitor');
        can('read', 'RecurringPass', { condoId: scope.condoId ?? '' });
        can('read', 'Defect', { condoId: scope.condoId ?? '' });
        can('update', 'Defect', { condoId: scope.condoId ?? '' });
        can('read', 'DefectReport', { condoId: scope.condoId ?? '' });
        can('update', 'DefectReport', { condoId: scope.condoId ?? '' });
        // Staff read handover config (unit types + taxonomy), admins manage it.
        can('read', 'UnitType', { condoId: scope.condoId ?? '' });
        can('read', 'DefectTaxonomy', { condoId: scope.condoId ?? '' });
        can('read', 'Invoice', { condoId: scope.condoId ?? '' });
        can('read', 'Deposit', { condoId: scope.condoId ?? '' });
        can('read', 'Receipt', { condoId: scope.condoId ?? '' });
        can('read', 'BillingSettings', { condoId: scope.condoId ?? '' });
        can('read', 'EInvoice', { condoId: scope.condoId ?? '' });
        can('read', 'Ledger', { condoId: scope.condoId ?? '' });
        can('read', 'GeneralLedger', { condoId: scope.condoId ?? '' });
        can('publish', 'Announcement', { condoId: scope.condoId ?? '' });
        can('read', 'Poll', { condoId: scope.condoId ?? '' });
        can('read', 'GeneralMeeting', { condoId: scope.condoId ?? '' });
        can('read', 'MeetingResolution', { condoId: scope.condoId ?? '' });
        can('read', 'MeetingProxy', { condoId: scope.condoId ?? '' });
        can('read', 'Facility', { condoId: scope.condoId ?? '' });
        can('read', 'Booking', { condoId: scope.condoId ?? '' });
        can('read', 'Thread', { condoId: scope.condoId ?? '' });
        can('update', 'Thread', { condoId: scope.condoId ?? '' });
        can('create', 'ThreadMessage');
        can('read', 'Faq', { condoId: scope.condoId ?? '' });
        can('read', 'User');
        can('update', 'User');
        can('read', 'SlaPolicy', { condoId: scope.condoId ?? '' });
        can('read', 'McpServer', { condoId: scope.condoId ?? '' });
        // Guard safety: staff triage SOS + view patrol coverage.
        can('read', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('acknowledge', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('resolve', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('cancel', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('read', 'PatrolCheckpoint', { condoId: scope.condoId ?? '' });
        can('read', 'PatrolScan', { condoId: scope.condoId ?? '' });
        can('read', 'Parcel', { condoId: scope.condoId ?? '' });
        can('read', 'FormTemplate', { condoId: scope.condoId ?? '' });
        can('read', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('approve', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('reject', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('verify', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('read', 'DocumentFolder', { condoId: scope.condoId ?? '' });
        can('read', 'Document', { condoId: scope.condoId ?? '' });
        can('manage', 'DocumentVersion', { condoId: scope.condoId ?? '' });
        can('read', 'LostFoundPost', { condoId: scope.condoId ?? '' });
        can('manage', 'LostFoundPost', { condoId: scope.condoId ?? '' });
        can('read', 'Vendor', { condoId: scope.condoId ?? '' });
        can('read', 'VendorBill', { condoId: scope.condoId ?? '' });
        can('create', 'VendorBill', { condoId: scope.condoId ?? '' });
        can('update', 'VendorBill', { condoId: scope.condoId ?? '' });
        can('read', 'Notification', { condoId: scope.condoId ?? '' });
        can('export', 'User', { id: scope.userId });
        can('delete', 'User', { id: scope.userId });
        return;

      case RoleId.SECURITY_GUARD:
        can('read', 'Visitor', { condoId: scope.condoId ?? '' });
        can('read', 'Unit', { condoId: scope.condoId ?? '' });
        can('check-in', 'Visitor', { condoId: scope.condoId ?? '' });
        can('check-out', 'Visitor', { condoId: scope.condoId ?? '' });
        can('create-walk-in', 'Visitor', { condoId: scope.condoId ?? '' });
        // Guard safety: respond to SOS + run patrol rounds.
        can('read', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('acknowledge', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('resolve', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('cancel', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('create', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('read', 'PatrolCheckpoint', { condoId: scope.condoId ?? '' });
        can('create', 'PatrolScan', { condoId: scope.condoId ?? '' });
        can('read', 'PatrolScan', { condoId: scope.condoId ?? '' });
        can('create', 'Parcel', { condoId: scope.condoId ?? '' });
        can('read', 'Parcel', { condoId: scope.condoId ?? '' });
        can('collect', 'Parcel', { condoId: scope.condoId ?? '' });
        can('verify', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('export', 'User', { id: scope.userId });
        can('delete', 'User', { id: scope.userId });
        return;

      case RoleId.UNIT_OWNER:
        can('read', 'Condo', { id: scope.condoId ?? '' });
        can('read', 'Unit', { id: scope.unitId ?? '' });
        // Explicit visitor actions only — never `manage Visitor`, which would
        // also imply gate ops (check-in / create-walk-in) via CASL.
        can('create', 'Visitor', { unitId: scope.unitId ?? '' });
        can('read', 'Visitor', { unitId: scope.unitId ?? '' });
        can('delete', 'Visitor', { unitId: scope.unitId ?? '' });
        can('approve', 'Visitor', { unitId: scope.unitId ?? '' });
        can('reject', 'Visitor', { unitId: scope.unitId ?? '' });
        can('manage', 'FavouriteVisitor', { unitId: scope.unitId ?? '' });
        can('manage', 'RecurringPass', { unitId: scope.unitId ?? '' });
        can('read', 'Invoice', { unitId: scope.unitId ?? '' });
        can('pay', 'Invoice', { unitId: scope.unitId ?? '' });
        can('read', 'Deposit', { unitId: scope.unitId ?? '' });
        can('read', 'Receipt', { unitId: scope.unitId ?? '' });
        can('read', 'Ledger', { unitId: scope.unitId ?? '' });
        can('manage', 'Defect', { unitId: scope.unitId ?? '' });
        can('manage', 'DefectReport', { unitId: scope.unitId ?? '' });
        can('read', 'Announcement', { condoId: scope.condoId ?? '' });
        can('acknowledge', 'Announcement');
        can('read', 'Poll', { condoId: scope.condoId ?? '' });
        can('vote', 'Poll', { condoId: scope.condoId ?? '' });
        can('read', 'GeneralMeeting', { condoId: scope.condoId ?? '' });
        can('submit-proxy', 'MeetingProxy', { condoId: scope.condoId ?? '' });
        can('read', 'MeetingResolution', { condoId: scope.condoId ?? '' });
        can('vote', 'MeetingResolution', { condoId: scope.condoId ?? '' });
        can('read', 'Facility', { condoId: scope.condoId ?? '' });
        can('create', 'Booking', { condoId: scope.condoId ?? '' });
        can('read', 'Booking', { condoId: scope.condoId ?? '' });
        can('cancel', 'Booking', { condoId: scope.condoId ?? '' });
        can('read', 'Parcel', { unitId: scope.unitId ?? '' });
        can('collect', 'Parcel', { unitId: scope.unitId ?? '' });
        can('read', 'FormTemplate', { condoId: scope.condoId ?? '' });
        can('create', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('read', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('update', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('cancel', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('read', 'DocumentFolder', { condoId: scope.condoId ?? '' });
        can('read', 'Document', { condoId: scope.condoId ?? '' });
        can('read', 'DocumentVersion', { condoId: scope.condoId ?? '' });
        can('create', 'LostFoundPost', { condoId: scope.condoId ?? '' });
        can('read', 'LostFoundPost', { condoId: scope.condoId ?? '' });
        can('resolve', 'LostFoundPost', { userId: scope.userId });
        can('delete', 'LostFoundPost', { userId: scope.userId });
        can('manage', 'Tenancy', { unitId: scope.unitId ?? '' });
        can('manage', 'HouseholdMember', { unitId: scope.unitId ?? '' });
        can('invite', 'User');
        can('revoke', 'RoleAssignment', { unitId: scope.unitId ?? '' });
        can('read', 'Thread', { unitId: scope.unitId ?? '' });
        can('create', 'Thread');
        // Resident-driven resolution (D2): residents confirm/resolve their threads.
        can('resolve', 'Thread', { unitId: scope.unitId ?? '' });
        can('create', 'ThreadMessage');
        can('read', 'Faq', { condoId: scope.condoId ?? '' });
        // Owner empowerment: full read on own unit's audit log + condo SLA audit (G1)
        can('read', 'AuditLog', { unitId: scope.unitId ?? '' });
        can('read', 'SlaPolicy', { condoId: scope.condoId ?? '' });
        // Panic / SOS: residents can raise, view, and cancel their own alert.
        can('create', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('read', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('cancel', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('read', 'User', { id: scope.userId });
        can('update', 'User', { id: scope.userId });
        can('export', 'User', { id: scope.userId });
        can('delete', 'User', { id: scope.userId });
        return;

      case RoleId.TENANT:
        can('read', 'Condo', { id: scope.condoId ?? '' });
        can('read', 'Unit', { id: scope.unitId ?? '' });
        // Same as owner: unit-scoped visitor CRUD/approve — not gate operations.
        can('create', 'Visitor', { unitId: scope.unitId ?? '' });
        can('read', 'Visitor', { unitId: scope.unitId ?? '' });
        can('delete', 'Visitor', { unitId: scope.unitId ?? '' });
        can('approve', 'Visitor', { unitId: scope.unitId ?? '' });
        can('reject', 'Visitor', { unitId: scope.unitId ?? '' });
        can('manage', 'FavouriteVisitor', { unitId: scope.unitId ?? '' });
        can('manage', 'RecurringPass', { unitId: scope.unitId ?? '' });
        can('read', 'Invoice', { unitId: scope.unitId ?? '' });
        can('read', 'Deposit', { unitId: scope.unitId ?? '' });
        can('read', 'Receipt', { unitId: scope.unitId ?? '' });
        can('read', 'Ledger', { unitId: scope.unitId ?? '' });
        can('manage', 'Defect', { unitId: scope.unitId ?? '' });
        can('manage', 'DefectReport', { unitId: scope.unitId ?? '' });
        can('read', 'Announcement', { condoId: scope.condoId ?? '' });
        can('acknowledge', 'Announcement');
        can('read', 'Poll', { condoId: scope.condoId ?? '' });
        can('read', 'Facility', { condoId: scope.condoId ?? '' });
        can('create', 'Booking', { condoId: scope.condoId ?? '' });
        can('read', 'Booking', { condoId: scope.condoId ?? '' });
        can('cancel', 'Booking', { condoId: scope.condoId ?? '' });
        can('read', 'Parcel', { unitId: scope.unitId ?? '' });
        can('collect', 'Parcel', { unitId: scope.unitId ?? '' });
        can('read', 'FormTemplate', { condoId: scope.condoId ?? '' });
        can('create', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('read', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('update', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('cancel', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('read', 'DocumentFolder', { condoId: scope.condoId ?? '' });
        can('read', 'Document', { condoId: scope.condoId ?? '' });
        can('read', 'DocumentVersion', { condoId: scope.condoId ?? '' });
        can('create', 'LostFoundPost', { condoId: scope.condoId ?? '' });
        can('read', 'LostFoundPost', { condoId: scope.condoId ?? '' });
        can('resolve', 'LostFoundPost', { userId: scope.userId });
        can('delete', 'LostFoundPost', { userId: scope.userId });
        can('read', 'Thread', { unitId: scope.unitId ?? '' });
        can('create', 'Thread');
        can('resolve', 'Thread', { unitId: scope.unitId ?? '' });
        can('create', 'ThreadMessage');
        can('read', 'Faq', { condoId: scope.condoId ?? '' });
        // Panic / SOS: residents can raise, view, and cancel their own alert.
        can('create', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('read', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('cancel', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('read', 'User', { id: scope.userId });
        can('update', 'User', { id: scope.userId });
        can('export', 'User', { id: scope.userId });
        can('delete', 'User', { id: scope.userId });
        return;

      case RoleId.HOUSEHOLD_MEMBER:
        can('read', 'Unit', { id: scope.unitId ?? '' });
        // Household may pre-register / cancel / view — not approve walk-ins (owner/tenant).
        can('create', 'Visitor', { unitId: scope.unitId ?? '' });
        can('read', 'Visitor', { unitId: scope.unitId ?? '' });
        can('delete', 'Visitor', { unitId: scope.unitId ?? '' });
        can('read', 'Announcement', { condoId: scope.condoId ?? '' });
        can('read', 'Poll', { condoId: scope.condoId ?? '' });
        can('read', 'Facility', { condoId: scope.condoId ?? '' });
        can('create', 'Booking', { condoId: scope.condoId ?? '' });
        can('read', 'Booking', { condoId: scope.condoId ?? '' });
        can('cancel', 'Booking', { condoId: scope.condoId ?? '' });
        can('read', 'Parcel', { unitId: scope.unitId ?? '' });
        can('read', 'FormTemplate', { condoId: scope.condoId ?? '' });
        can('create', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('read', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('update', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('cancel', 'FormSubmission', { condoId: scope.condoId ?? '' });
        can('read', 'DocumentFolder', { condoId: scope.condoId ?? '' });
        can('read', 'Document', { condoId: scope.condoId ?? '' });
        can('read', 'DocumentVersion', { condoId: scope.condoId ?? '' });
        can('create', 'LostFoundPost', { condoId: scope.condoId ?? '' });
        can('read', 'LostFoundPost', { condoId: scope.condoId ?? '' });
        can('resolve', 'LostFoundPost', { userId: scope.userId });
        can('delete', 'LostFoundPost', { userId: scope.userId });
        can('read', 'Thread', { unitId: scope.unitId ?? '' });
        can('create', 'Thread');
        can('resolve', 'Thread', { unitId: scope.unitId ?? '' });
        can('create', 'ThreadMessage');
        can('read', 'Faq', { condoId: scope.condoId ?? '' });
        // Panic / SOS: household members can raise, view, and cancel their own alert.
        can('create', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('read', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('cancel', 'SosAlert', { condoId: scope.condoId ?? '' });
        can('read', 'User', { id: scope.userId });
        can('export', 'User', { id: scope.userId });
        can('delete', 'User', { id: scope.userId });
        return;

      case RoleId.CONTRACTOR:
        can('read', 'Defect');
        can('update', 'Defect');
        can('export', 'User', { id: scope.userId });
        can('delete', 'User', { id: scope.userId });
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
