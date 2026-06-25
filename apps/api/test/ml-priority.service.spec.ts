import type { PrismaService } from '@/prisma/prisma.service';
import type { ThreadPriorityService } from '@/threads/sla/thread-priority.service';
import { describe, expect, it, vi } from 'vitest';
import { ML_PRIORITY_MIN_CLOSED_THREADS } from '../src/threads/ml/ml-priority.constants';
import { MlPriorityService } from '../src/threads/ml/ml-priority.service';

const CONDO = 'condo-ml';

describe('MlPriorityService', () => {
  function svc(opts: {
    closedCount?: number;
    mlEnabled?: boolean;
    rulesPriority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
    threads?: Array<{ subject: string; priority: string; messages: Array<{ body: string }> }>;
  }) {
    const rules = {
      suggest: vi.fn(() => opts.rulesPriority ?? 'NORMAL'),
    } as unknown as ThreadPriorityService;

    const prisma = {
      condo: {
        findUnique: vi.fn(async () => ({
          settings: {
            helpdesk: { mlPriorityEnabled: opts.mlEnabled ?? false },
          },
        })),
      },
      thread: {
        count: vi.fn(async () => opts.closedCount ?? 0),
        findMany: vi.fn(async () => opts.threads ?? []),
      },
    } as unknown as PrismaService;

    return { service: new MlPriorityService(prisma, rules), rules };
  }

  it('reports not ready below minimum closed threads', async () => {
    const { service } = svc({ closedCount: 50 });
    const stats = await service.getStats(CONDO);
    expect(stats.ready).toBe(false);
    expect(stats.minRequired).toBe(ML_PRIORITY_MIN_CLOSED_THREADS);
    expect(stats.active).toBe(false);
  });

  it('uses rules when ML is disabled', async () => {
    const { service } = svc({ closedCount: 300, mlEnabled: false, rulesPriority: 'HIGH' });
    const result = await service.suggest({
      condoId: CONDO,
      subject: 'Leaking pipe',
      body: 'Water in kitchen',
      category: 'MAINTENANCE',
    });
    expect(result).toEqual({ priority: 'HIGH', source: 'rules' });
  });

  it('safety keywords force rules_safety even when ML is enabled', async () => {
    const { service } = svc({
      closedCount: 300,
      mlEnabled: true,
      rulesPriority: 'NORMAL',
      threads: [
        { subject: 'Fire alarm', priority: 'LOW', messages: [{ body: 'newsletter' }] },
        { subject: 'Garden', priority: 'LOW', messages: [{ body: 'plants' }] },
      ],
    });
    const result = await service.suggest({
      condoId: CONDO,
      subject: 'Smoke smell',
      body: 'fire in corridor',
      category: 'SECURITY',
    });
    expect(result.source).toBe('rules_safety');
    expect(result.priority).toBe('NORMAL');
  });
});
