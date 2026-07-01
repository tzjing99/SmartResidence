import { SETUP_STEP_ORDER, type SetupStepKey } from '@smartresidence/shared-types';

/**
 * Persisted first-time-setup state stored under `Condo.settings.setup`.
 * Mirrors the parse/merge pattern in `sla/helpdesk-settings.ts`.
 */
export interface StoredSetupStep {
  done: boolean;
  skipped: boolean;
  updatedAt: string;
}

export interface StoredSetupState {
  completedAt: string | null;
  dismissedAt: string | null;
  steps: Partial<Record<SetupStepKey, StoredSetupStep>>;
}

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function parseStep(raw: unknown): StoredSetupStep | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    done: obj.done === true,
    skipped: obj.skipped === true,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date(0).toISOString(),
  };
}

/** Read the setup block from condo settings, tolerating missing/legacy shapes. */
export function parseSetupState(settings: unknown): StoredSetupState {
  const setup = asObject(asObject(settings).setup);
  const rawSteps = asObject(setup.steps);
  const steps: StoredSetupState['steps'] = {};
  for (const key of SETUP_STEP_ORDER) {
    const parsed = parseStep(rawSteps[key]);
    if (parsed) steps[key] = parsed;
  }
  return {
    completedAt: typeof setup.completedAt === 'string' ? setup.completedAt : null,
    dismissedAt: typeof setup.dismissedAt === 'string' ? setup.dismissedAt : null,
    steps,
  };
}

/**
 * Merge a partial setup patch into the existing condo settings JSON, returning
 * the full settings object ready to persist. Only the provided fields change;
 * every other setting (billing, helpdesk, ...) is preserved.
 */
export function mergeSetupState(
  settings: unknown,
  patch: {
    completedAt?: string | null;
    dismissedAt?: string | null;
    step?: { key: SetupStepKey; done?: boolean; skipped?: boolean };
  },
): Record<string, unknown> {
  const base = asObject(settings);
  const current = parseSetupState(settings);
  const nextSteps: StoredSetupState['steps'] = { ...current.steps };

  if (patch.step) {
    const existing = nextSteps[patch.step.key];
    nextSteps[patch.step.key] = {
      done: patch.step.done ?? existing?.done ?? false,
      skipped: patch.step.skipped ?? existing?.skipped ?? false,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    ...base,
    setup: {
      completedAt: patch.completedAt !== undefined ? patch.completedAt : current.completedAt,
      dismissedAt: patch.dismissedAt !== undefined ? patch.dismissedAt : current.dismissedAt,
      steps: nextSteps,
    },
  };
}
