import type { AutoAssignmentSettings, HelpdeskSettings } from '@/sla/helpdesk-settings';
import { Injectable } from '@nestjs/common';
import type { ThreadCategory, ThreadPriority } from '@prisma/client';

/**
 * DI token for the active assignment-assist implementation. Bind a different
 * provider (e.g. a real ML model) in ThreadsModule without touching callers.
 */
export const ASSIGNMENT_ASSIST_PROVIDER = Symbol('ASSIGNMENT_ASSIST_PROVIDER');

export interface AssignmentAssistInput {
  condoId: string;
  category: ThreadCategory;
  subject: string;
  body?: string;
  repeatComplainant: boolean;
  helpdesk: HelpdeskSettings;
}

export type AssignmentSuggestionSource = 'rules' | 'ml-stub' | 'ml';

export interface AssignmentSuggestion {
  poolUserIds: string[];
  source: AssignmentSuggestionSource;
}

export interface AssignmentAssistProvider {
  /** Suggest an assignee pool; null = no suggestion (caller uses rules fallback). */
  suggestPool(input: AssignmentAssistInput): Promise<AssignmentSuggestion | null>;
}

/** Resolve pool from category / repeat-complainant rules (phase 1). */
export function resolveRulesPool(
  auto: AutoAssignmentSettings | undefined,
  category: ThreadCategory,
  repeatComplainant: boolean,
): string[] {
  if (!auto) return [];
  if (repeatComplainant && auto.seniorStaffPool?.length) {
    return auto.seniorStaffPool;
  }
  const catPool = auto.categoryPools?.find((p) => p.category === category);
  if (catPool?.userIds?.length) return catPool.userIds;
  if (category === 'GENERAL' && auto.generalTriagePool?.length) {
    return auto.generalTriagePool;
  }
  return [];
}

/** Resolve pool for priority escalation / de-escalation (M2). */
export function resolvePriorityPool(
  auto: AutoAssignmentSettings | undefined,
  priority: ThreadPriority,
  category: ThreadCategory,
  repeatComplainant: boolean,
): string[] {
  if (!auto) return [];
  if (repeatComplainant && auto.seniorStaffPool?.length) {
    return auto.seniorStaffPool;
  }
  if (priority === 'URGENT' || priority === 'HIGH') {
    const priPool = auto.priorityPools?.find((p) => p.priority === priority);
    if (priPool?.userIds?.length) return priPool.userIds;
    if (auto.seniorStaffPool?.length) return auto.seniorStaffPool;
    return [];
  }
  return resolveRulesPool(auto, category, false);
}

/**
 * Default provider: deterministic category → pool mapping (phase 1 rules).
 */
@Injectable()
export class RuleBasedAssignmentAssistProvider implements AssignmentAssistProvider {
  async suggestPool(input: AssignmentAssistInput): Promise<AssignmentSuggestion | null> {
    const poolUserIds = resolveRulesPool(
      input.helpdesk.autoAssignment,
      input.category,
      input.repeatComplainant,
    );
    return { poolUserIds, source: 'rules' };
  }
}
