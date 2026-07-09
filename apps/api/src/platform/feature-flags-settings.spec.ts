import { describe, expect, it } from 'vitest';
import {
  changedFlagKeys,
  mergePlatformFeatureFlags,
  resolvePlatformFeatureFlags,
} from './feature-flags-settings';

describe('feature-flags-settings', () => {
  it('defaults all flags to off when unset', () => {
    const result = resolvePlatformFeatureFlags('condo-1', {});
    expect(result.condoId).toBe('condo-1');
    expect(result.flags).toHaveLength(4);
    expect(result.flags.every((f) => f.enabled === false)).toBe(true);
  });

  it('reads stored featureFlags and prefers helpdesk ML settings', () => {
    const result = resolvePlatformFeatureFlags('condo-1', {
      featureFlags: {
        whatsappNotifications: true,
        helpdeskMlAssignee: false,
      },
      helpdesk: {
        mlPriorityEnabled: true,
        autoAssignment: {
          generalTriagePool: [],
          categoryPools: [],
          seniorStaffPool: [],
          mlEnabled: true,
        },
      },
    });

    const byKey = Object.fromEntries(result.flags.map((f) => [f.key, f.enabled]));
    expect(byKey).toMatchObject({
      helpdeskMlAssignee: true,
      helpdeskMlPriority: true,
      whatsappNotifications: true,
      residentAiAssist: false,
    });
  });

  it('merges patch into settings.featureFlags and syncs helpdesk ML keys', () => {
    const merged = mergePlatformFeatureFlags(
      {
        setup: { completedAt: '2026-01-01T00:00:00.000Z' },
        helpdesk: {
          resolutionConfirmationGraceDays: 7,
          autoAssignment: {
            generalTriagePool: ['user-1'],
            categoryPools: [],
            seniorStaffPool: [],
            mlEnabled: false,
          },
        },
      },
      { helpdeskMlAssignee: true, whatsappNotifications: true },
    );

    expect(merged.setup).toEqual({ completedAt: '2026-01-01T00:00:00.000Z' });
    expect(merged.featureFlags).toMatchObject({
      helpdeskMlAssignee: true,
      whatsappNotifications: true,
      helpdeskMlPriority: false,
      residentAiAssist: false,
    });

    const helpdesk = merged.helpdesk as {
      autoAssignment: { mlEnabled: boolean; generalTriagePool: string[] };
      mlPriorityEnabled: boolean;
    };
    expect(helpdesk.autoAssignment.mlEnabled).toBe(true);
    expect(helpdesk.autoAssignment.generalTriagePool).toEqual(['user-1']);
    expect(helpdesk.mlPriorityEnabled).toBe(false);
  });

  it('reports changed flag keys', () => {
    const before = resolvePlatformFeatureFlags('c', {});
    const after = resolvePlatformFeatureFlags('c', {
      featureFlags: { residentAiAssist: true },
    });
    expect(changedFlagKeys(before, after)).toEqual(['residentAiAssist']);
  });
});
