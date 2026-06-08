import { PrismaService } from '@/prisma/prisma.service';
import { parseHelpdeskSettings } from '@/sla/helpdesk-settings';
import { Injectable } from '@nestjs/common';
import type { ThreadCategory, ThreadPriority } from '@prisma/client';
import { ThreadPriorityService } from '../sla/thread-priority.service';
import {
  CLOSED_THREAD_STATUSES,
  ML_PRIORITY_MIN_CLOSED_THREADS,
  ML_PRIORITY_MODEL_CACHE_MS,
} from './ml-priority.constants';
import {
  type NaiveBayesModel,
  type PredictionResult,
  predictNaiveBayes,
  tokenize,
  trainNaiveBayes,
} from './naive-bayes-text';

export interface MlPriorityStats {
  enabled: boolean;
  closedThreadCount: number;
  minRequired: number;
  ready: boolean;
  active: boolean;
}

interface CachedModel {
  model: NaiveBayesModel;
  trainedAt: number;
  sampleCount: number;
}

@Injectable()
export class MlPriorityService {
  private readonly cache = new Map<string, CachedModel>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: ThreadPriorityService,
  ) {}

  async getStats(condoId: string): Promise<MlPriorityStats> {
    const condo = await this.prisma.condo.findUnique({
      where: { id: condoId },
      select: { settings: true },
    });
    const helpdesk = parseHelpdeskSettings(condo?.settings);
    const closedThreadCount = await this.countClosedThreads(condoId);
    const ready = closedThreadCount >= ML_PRIORITY_MIN_CLOSED_THREADS;
    const enabled = helpdesk.mlPriorityEnabled === true;
    return {
      enabled,
      closedThreadCount,
      minRequired: ML_PRIORITY_MIN_CLOSED_THREADS,
      ready,
      active: enabled && ready,
    };
  }

  /**
   * Suggest priority: safety rules always win, then ML when enabled + trained, else rules.
   */
  async suggest(input: {
    condoId: string;
    subject: string;
    body: string;
    category: ThreadCategory;
  }): Promise<{ priority: ThreadPriority; source: 'rules_safety' | 'ml' | 'rules' }> {
    const rulesInput = {
      subject: input.subject,
      body: input.body,
      category: input.category,
    };

    const rulesPriority = this.rules.suggest(rulesInput);
    if (this.isSafetyOverride(rulesInput, rulesPriority)) {
      return { priority: rulesPriority, source: 'rules_safety' };
    }

    const stats = await this.getStats(input.condoId);
    if (!stats.active) {
      return { priority: rulesPriority, source: 'rules' };
    }

    const prediction = await this.predict(input.condoId, input.subject, input.body);
    if (prediction) {
      return { priority: prediction.priority, source: 'ml' };
    }

    return { priority: rulesPriority, source: 'rules' };
  }

  private isSafetyOverride(
    input: { subject: string; body: string; category: ThreadCategory },
    rulesPriority: ThreadPriority,
  ): boolean {
    if (rulesPriority === 'URGENT') return true;
    const text = `${input.subject} ${input.body}`.toLowerCase();
    const urgentHits = ['fire', 'smoke', 'gas leak', 'flood', 'trapped', 'emergency', 'injured'];
    return urgentHits.some((k) => text.includes(k));
  }

  private async predict(
    condoId: string,
    subject: string,
    body: string,
  ): Promise<PredictionResult | null> {
    const model = await this.getOrTrainModel(condoId);
    if (!model) return null;
    return predictNaiveBayes(model, tokenize(`${subject} ${body}`));
  }

  private async getOrTrainModel(condoId: string): Promise<NaiveBayesModel | null> {
    const cached = this.cache.get(condoId);
    if (cached && Date.now() - cached.trainedAt < ML_PRIORITY_MODEL_CACHE_MS) {
      return cached.model;
    }

    const threads = await this.prisma.thread.findMany({
      where: { condoId, status: { in: [...CLOSED_THREAD_STATUSES] } },
      select: { subject: true, priority: true, messages: { take: 1, orderBy: { createdAt: 'asc' }, select: { body: true } } },
      take: 5000,
      orderBy: { closedAt: 'desc' },
    });

    const samples = threads.map((t) => ({
      priority: t.priority,
      tokens: tokenize(`${t.subject} ${t.messages[0]?.body ?? ''}`),
    }));

    const model = trainNaiveBayes(samples);
    if (!model) return null;

    this.cache.set(condoId, {
      model,
      trainedAt: Date.now(),
      sampleCount: samples.length,
    });
    return model;
  }

  private countClosedThreads(condoId: string): Promise<number> {
    return this.prisma.thread.count({
      where: { condoId, status: { in: [...CLOSED_THREAD_STATUSES] } },
    });
  }

  invalidateModel(condoId: string): void {
    this.cache.delete(condoId);
  }
}
