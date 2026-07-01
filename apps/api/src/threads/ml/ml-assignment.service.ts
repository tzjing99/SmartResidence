import { PrismaService } from '@/prisma/prisma.service';
import { parseHelpdeskSettings } from '@/sla/helpdesk-settings';
import { Injectable } from '@nestjs/common';
import type { ThreadCategory } from '@prisma/client';
import type { AssignmentAssistInput, AssignmentSuggestion } from '../ai/assignment-assist.provider';
import { resolveRulesPool } from '../ai/assignment-assist.provider';
import {
  CLOSED_THREAD_STATUSES,
  ML_ASSIGNMENT_MIN_CLOSED_THREADS,
} from './ml-assignment.constants';

export interface MlAssignmentStats {
  enabled: boolean;
  closedThreadCount: number;
  minRequired: number;
  ready: boolean;
  active: boolean;
}

/** Keyword → category heuristics for the phase-2 stub (not a real model). */
const CATEGORY_KEYWORDS: Array<{ category: ThreadCategory; keywords: string[] }> = [
  {
    category: 'BILLING',
    keywords: ['invoice', 'billing', 'payment', 'fee', 'charge', 'statement'],
  },
  {
    category: 'MAINTENANCE',
    keywords: ['leak', 'repair', 'broken', 'pipe', 'lift', 'elevator', 'aircon', 'water'],
  },
  { category: 'SECURITY', keywords: ['security', 'theft', 'break-in', 'cctv', 'access card'] },
  { category: 'FACILITY', keywords: ['gym', 'pool', 'bbq', 'facility', 'function room'] },
  { category: 'COMPLAINT', keywords: ['noise', 'complaint', 'neighbour', 'smoking', 'parking'] },
];

@Injectable()
export class MlAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(condoId: string): Promise<MlAssignmentStats> {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { settings: true },
    });
    const helpdesk = parseHelpdeskSettings(condo?.settings);
    const closedThreadCount = await this.countClosedThreads(condoId);
    const ready = closedThreadCount >= ML_ASSIGNMENT_MIN_CLOSED_THREADS;
    const enabled = helpdesk.autoAssignment?.mlEnabled === true;
    return {
      enabled,
      closedThreadCount,
      minRequired: ML_ASSIGNMENT_MIN_CLOSED_THREADS,
      ready,
      active: enabled && ready,
    };
  }

  /**
   * Stub assignee suggestion: keyword/category heuristics labeled `ml-stub`.
   * Returns null when disabled or insufficient closed-thread history.
   */
  async suggestPool(input: AssignmentAssistInput): Promise<AssignmentSuggestion | null> {
    const stats = await this.getStats(input.condoId);
    if (!stats.active) return null;

    const inferred = this.inferCategory(`${input.subject} ${input.body ?? ''}`);
    const category = inferred ?? input.category;
    const poolUserIds = resolveRulesPool(
      input.helpdesk.autoAssignment,
      category,
      input.repeatComplainant,
    );
    if (poolUserIds.length === 0) return null;

    return { poolUserIds, source: 'ml-stub' };
  }

  private inferCategory(text: string): ThreadCategory | null {
    const lower = text.toLowerCase();
    for (const { category, keywords } of CATEGORY_KEYWORDS) {
      if (keywords.some((k) => lower.includes(k))) return category;
    }
    return null;
  }

  private countClosedThreads(condoId: string): Promise<number> {
    return this.prisma.thread.count({
      where: { condoId, status: { in: [...CLOSED_THREAD_STATUSES] } },
    });
  }
}
