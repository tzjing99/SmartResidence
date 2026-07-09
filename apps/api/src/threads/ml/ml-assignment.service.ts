import { PrismaService } from '@/prisma/prisma.service';
import { parseHelpdeskSettings } from '@/sla/helpdesk-settings';
import { Injectable, Logger } from '@nestjs/common';
import type { ThreadCategory } from '@prisma/client';
import type { AssignmentAssistInput, AssignmentSuggestion } from '../ai/assignment-assist.provider';
import { resolveRulesPool } from '../ai/assignment-assist.provider';
import { type AssignmentCategoryModel, predictCategoryFromText } from './assignment-category-model';
import { loadAssignmentCategoryModelFromDisk } from './assignment-model-store';
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
  modelLoaded: boolean;
  modelSampleCount: number | null;
  modelTrainedAt: string | null;
}

@Injectable()
export class MlAssignmentService {
  private readonly logger = new Logger(MlAssignmentService.name);
  private cachedModel: AssignmentCategoryModel | null | undefined;
  private testOverride: AssignmentCategoryModel | null | undefined;

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
    const model = this.getModel();
    return {
      enabled,
      closedThreadCount,
      minRequired: ML_ASSIGNMENT_MIN_CLOSED_THREADS,
      ready,
      active: enabled && ready,
      modelLoaded: model !== null,
      modelSampleCount: model?.totalSamples ?? null,
      modelTrainedAt: model?.trainedAt ?? null,
    };
  }

  /**
   * Trained-model assignee suggestion (C6): Naive Bayes category inference →
   * category pool. Returns null when disabled, below the closed-thread gate,
   * or when no model artifact is available (caller falls back to rules).
   */
  async suggestPool(input: AssignmentAssistInput): Promise<AssignmentSuggestion | null> {
    const stats = await this.getStats(input.condoId);
    if (!stats.active) return null;

    const model = this.getModel();
    if (!model) return null;

    const prediction = predictCategoryFromText(model, `${input.subject} ${input.body ?? ''}`);
    const category: ThreadCategory = prediction?.category ?? input.category;

    const poolUserIds = resolveRulesPool(
      input.helpdesk.autoAssignment,
      category,
      input.repeatComplainant,
    );
    if (poolUserIds.length === 0) return null;

    return { poolUserIds, source: 'ml' };
  }

  /** Force reload from disk (e.g. after `ml:train-assignment`). */
  invalidateModel(): void {
    this.cachedModel = undefined;
  }

  /** Test-only: inject or clear the in-memory model without touching disk. */
  setModelForTests(model: AssignmentCategoryModel | null): void {
    this.testOverride = model;
  }

  private getModel(): AssignmentCategoryModel | null {
    if (this.testOverride !== undefined) return this.testOverride;
    if (this.cachedModel !== undefined) return this.cachedModel;

    const loaded = loadAssignmentCategoryModelFromDisk();
    this.cachedModel = loaded;
    if (loaded) {
      this.logger.log(
        `Loaded assignment ML model (${loaded.totalSamples} samples, trained ${loaded.trainedAt})`,
      );
    } else {
      this.logger.warn(
        'Assignment ML model artifact missing; ML suggestions disabled until trained',
      );
    }
    return loaded;
  }

  private countClosedThreads(condoId: string): Promise<number> {
    return this.prisma.thread.count({
      where: { condoId, status: { in: [...CLOSED_THREAD_STATUSES] } },
    });
  }
}
