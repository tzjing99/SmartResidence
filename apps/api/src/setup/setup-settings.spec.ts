import { describe, expect, it } from 'vitest';
import { mergeSetupState, parseSetupState } from './setup-settings';

describe('setup settings', () => {
  it('returns an empty, uncompleted state when unset', () => {
    const state = parseSetupState(undefined);
    expect(state.completedAt).toBeNull();
    expect(state.dismissedAt).toBeNull();
    expect(state.steps).toEqual({});
  });

  it('reads persisted step flags', () => {
    const settings = {
      setup: {
        completedAt: null,
        steps: { structure: { done: true, skipped: false, updatedAt: '2026-07-01T00:00:00.000Z' } },
      },
    };
    const state = parseSetupState(settings);
    expect(state.steps.structure?.done).toBe(true);
    expect(state.steps.structure?.updatedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('merges a step patch without dropping other settings or steps', () => {
    const settings = {
      billing: { receipt: { organizationName: 'Acacia JMB' } },
      setup: {
        completedAt: null,
        steps: { structure: { done: true, skipped: false, updatedAt: '2026-01-01T00:00:00.000Z' } },
      },
    };
    const merged = mergeSetupState(settings, {
      step: { key: 'billing', done: false, skipped: true },
    }) as {
      billing: { receipt: Record<string, string> };
      setup: { completedAt: string | null; steps: Record<string, { skipped: boolean }> };
    };
    expect(merged.billing.receipt.organizationName).toBe('Acacia JMB');
    expect(merged.setup.steps.structure?.skipped).toBe(false);
    expect(merged.setup.steps.billing?.skipped).toBe(true);
    expect(merged.setup.completedAt).toBeNull();
  });

  it('is idempotent-friendly: preserves completedAt unless explicitly changed', () => {
    const settings = { setup: { completedAt: '2026-07-01T00:00:00.000Z', steps: {} } };
    const untouched = mergeSetupState(settings, {
      step: { key: 'residents', done: true },
    }) as { setup: { completedAt: string } };
    expect(untouched.setup.completedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('persists dismissedAt without clearing other setup fields', () => {
    const settings = {
      setup: {
        completedAt: null,
        dismissedAt: null,
        steps: { structure: { done: true, skipped: false, updatedAt: '2026-01-01T00:00:00.000Z' } },
      },
    };
    const merged = mergeSetupState(settings, {
      dismissedAt: '2026-07-01T12:00:00.000Z',
    }) as { setup: { dismissedAt: string; steps: Record<string, { done: boolean }> } };
    expect(merged.setup.dismissedAt).toBe('2026-07-01T12:00:00.000Z');
    expect(merged.setup.steps.structure?.done).toBe(true);
  });
});
