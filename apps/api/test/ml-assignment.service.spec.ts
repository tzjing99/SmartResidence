import type { PrismaService } from '@/prisma/prisma.service';
import { parseHelpdeskSettings } from '@/sla/helpdesk-settings';
import { ThreadCategory } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CompositeAssignmentAssistProvider } from '../src/threads/ai/composite-assignment-assist.provider';
import { RuleBasedAssignmentAssistProvider } from '../src/threads/ai/assignment-assist.provider';
import { ML_ASSIGNMENT_MIN_CLOSED_THREADS } from '../src/threads/ml/ml-assignment.constants';
import { MlAssignmentService } from '../src/threads/ml/ml-assignment.service';

const CONDO = 'condo-assign-ml';

function helpdeskSettings(mlEnabled: boolean) {
  return parseHelpdeskSettings({
    helpdesk: {
      autoAssignment: {
        mlEnabled,
        generalTriagePool: ['triage-1'],
        seniorStaffPool: [],
        categoryPools: [
          { category: ThreadCategory.GENERAL, userIds: ['general-1'] },
          { category: ThreadCategory.MAINTENANCE, userIds: ['maint-1', 'maint-2'] },
          { category: ThreadCategory.BILLING, userIds: ['bill-1'] },
        ],
      },
    },
  });
}

describe('CompositeAssignmentAssistProvider (C6 phase 2)', () => {
  function provider(opts: { closedCount?: number; mlEnabled?: boolean }) {
    const prisma = {
      condo: {
        findUnique: vi.fn(async () => ({
          settings: {
            helpdesk: {
              autoAssignment: { mlEnabled: opts.mlEnabled ?? false },
            },
          },
        })),
      },
      thread: {
        count: vi.fn(async () => opts.closedCount ?? 0),
      },
    } as unknown as PrismaService;

    const ml = new MlAssignmentService(prisma);
    const rules = new RuleBasedAssignmentAssistProvider();
    return new CompositeAssignmentAssistProvider(ml, rules);
  }

  it('uses rules when ML is disabled', async () => {
    const assist = provider({ closedCount: 300, mlEnabled: false });
    const helpdesk = helpdeskSettings(false);
    const result = await assist.suggestPool({
      condoId: CONDO,
      category: ThreadCategory.GENERAL,
      subject: 'Hello',
      repeatComplainant: false,
      helpdesk,
    });
    expect(result).toEqual({ poolUserIds: ['general-1'], source: 'rules' });
  });

  it('uses rules when ML enabled but below closed-thread threshold', async () => {
    const assist = provider({ closedCount: 50, mlEnabled: true });
    const helpdesk = helpdeskSettings(true);
    const result = await assist.suggestPool({
      condoId: CONDO,
      category: ThreadCategory.GENERAL,
      subject: 'Leaking pipe in kitchen',
      repeatComplainant: false,
      helpdesk,
    });
    expect(result).toEqual({ poolUserIds: ['general-1'], source: 'rules' });
  });

  it('uses ml-stub when ML enabled and enough closed threads', async () => {
    const assist = provider({ closedCount: ML_ASSIGNMENT_MIN_CLOSED_THREADS, mlEnabled: true });
    const helpdesk = helpdeskSettings(true);
    const result = await assist.suggestPool({
      condoId: CONDO,
      category: ThreadCategory.GENERAL,
      subject: 'Leaking pipe in kitchen',
      repeatComplainant: false,
      helpdesk,
    });
    expect(result).toEqual({
      poolUserIds: ['maint-1', 'maint-2'],
      source: 'ml-stub',
    });
  });
});
