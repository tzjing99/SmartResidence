import type { ThreadCategory } from '@prisma/client';

export const DEFAULT_RESOLUTION_CONFIRMATION_GRACE_DAYS = 7;

export interface CategoryAssigneePool {
  category: ThreadCategory;
  userIds: string[];
}

export interface AutoAssignmentSettings {
  /** GENERAL category / triage pool (C1). */
  generalTriagePool: string[];
  /** Per-category assignee pools. */
  categoryPools: CategoryAssigneePool[];
  /** Senior staff pool for repeat complainants (C5). */
  seniorStaffPool: string[];
}

export interface HelpdeskSettings {
  resolutionConfirmationGraceDays: number;
  autoAssignment?: AutoAssignmentSettings;
}

export function parseHelpdeskSettings(raw: unknown): HelpdeskSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const helpdesk = (obj.helpdesk && typeof obj.helpdesk === 'object'
    ? obj.helpdesk
    : {}) as Record<string, unknown>;
  const grace =
    typeof helpdesk.resolutionConfirmationGraceDays === 'number'
      ? helpdesk.resolutionConfirmationGraceDays
      : DEFAULT_RESOLUTION_CONFIRMATION_GRACE_DAYS;

  let autoAssignment: AutoAssignmentSettings | undefined;
  if (helpdesk.autoAssignment && typeof helpdesk.autoAssignment === 'object') {
    const aa = helpdesk.autoAssignment as Record<string, unknown>;
    autoAssignment = {
      generalTriagePool: Array.isArray(aa.generalTriagePool)
        ? (aa.generalTriagePool as string[])
        : [],
      categoryPools: Array.isArray(aa.categoryPools)
        ? (aa.categoryPools as CategoryAssigneePool[])
        : [],
      seniorStaffPool: Array.isArray(aa.seniorStaffPool) ? (aa.seniorStaffPool as string[]) : [],
    };
  }

  return {
    resolutionConfirmationGraceDays: Math.max(1, Math.min(30, grace)),
    autoAssignment,
  };
}

export function mergeHelpdeskSettings(
  existing: unknown,
  patch: Partial<HelpdeskSettings>,
): Record<string, unknown> {
  const base = (existing && typeof existing === 'object' ? existing : {}) as Record<
    string,
    unknown
  >;
  const current = parseHelpdeskSettings(existing);
  const merged: HelpdeskSettings = { ...current, ...patch };
  return { ...base, helpdesk: merged };
}
