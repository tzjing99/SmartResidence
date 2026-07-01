import { z } from 'zod';

//////////////////////////////////////////////////////////////////////////////
// F4 — First-time setup / onboarding wizard.
//
// Setup state lives under `Condo.settings.setup` (JSON) so no schema change is
// required. The API derives a live checklist from real data (blocks, units,
// fee rates, residents, ...) and merges it with the admin's per-step
// done/skipped flags to drive a resumable, idempotent wizard.
//////////////////////////////////////////////////////////////////////////////

/** Ordered wizard step identifiers. */
export const SetupStepKey = z.enum([
  'condoProfile',
  'structure',
  'billing',
  'residents',
  'operations',
  'integrations',
  'review',
]);
export type SetupStepKey = z.infer<typeof SetupStepKey>;

/** The steps in wizard order. */
export const SETUP_STEP_ORDER: SetupStepKey[] = [
  'condoProfile',
  'structure',
  'billing',
  'residents',
  'operations',
  'integrations',
  'review',
];

export interface SetupStepMeta {
  key: SetupStepKey;
  title: string;
  description: string;
  /** Where the admin goes to actually complete this step. */
  href: string;
  /** Whether the admin can skip this step (optional/deferred essentials). */
  skippable: boolean;
}

export const SETUP_STEP_META: Record<SetupStepKey, SetupStepMeta> = {
  condoProfile: {
    key: 'condoProfile',
    title: 'Building details',
    description: 'Confirm your building name, address, timezone, and branding.',
    href: '/admin/settings',
    skippable: false,
  },
  structure: {
    key: 'structure',
    title: 'Blocks and units',
    description:
      'Add at least one block, unit type, and unit so billing and resident access can work.',
    href: '/admin/units',
    skippable: false,
  },
  billing: {
    key: 'billing',
    title: 'Billing basics',
    description:
      'Set fee rates and receipt details. Turn on monthly invoice automation when you are ready.',
    href: '/admin/settings/billing',
    skippable: true,
  },
  residents: {
    key: 'residents',
    title: 'Invite residents',
    description: 'Add owners and tenants now, or skip and invite them later.',
    href: '/admin/units',
    skippable: true,
  },
  operations: {
    key: 'operations',
    title: 'Day-to-day rules',
    description: 'Set visitor rules, helpdesk response times, and how announcements go out.',
    href: '/admin/settings/visitors',
    skippable: true,
  },
  integrations: {
    key: 'integrations',
    title: 'Integrations (optional)',
    description: 'Connect email, WhatsApp, or other tools — skip if you do not need them yet.',
    href: '/admin/settings/integrations',
    skippable: true,
  },
  review: {
    key: 'review',
    title: 'Review and finish',
    description: 'Check what is done, then mark your building as ready.',
    href: '/admin/setup',
    skippable: false,
  },
};

/** Admin routes reachable while setup is incomplete (wizard links + billing automation). */
export const SETUP_WIZARD_PATH_PREFIXES: string[] = [
  '/admin/setup',
  '/admin/automations',
  ...new Set(Object.values(SETUP_STEP_META).map((m) => m.href)),
];

export function isSetupWizardPath(pathname: string): boolean {
  return SETUP_WIZARD_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Persisted per-step state (stored under `settings.setup.steps`). */
export interface SetupStepState {
  done: boolean;
  skipped: boolean;
  updatedAt: string;
}

/** Live, derived facts about how much of the essentials already exist. */
export interface SetupChecklistFacts {
  hasProfile: boolean;
  blockCount: number;
  unitTypeCount: number;
  unitCount: number;
  feeRateCount: number;
  hasReceiptTemplate: boolean;
  billingAutomationEnabled: boolean;
  enabledGatewayCount: number;
  residentCount: number;
  slaPolicyCount: number;
  mcpCount: number;
}

/**
 * A step as returned by the API: persisted flags + derived satisfaction.
 * `satisfied` is `null` when a step cannot be derived from data (toggles /
 * optional integrations) and relies purely on the admin's done/skip choice.
 */
export interface SetupStepStatus {
  key: SetupStepKey;
  done: boolean;
  skipped: boolean;
  updatedAt: string | null;
  satisfied: boolean | null;
}

export interface SetupStatus {
  condoId: string;
  completedAt: string | null;
  /** When set, the admin chose to defer the wizard (no forced redirect). */
  dismissedAt: string | null;
  steps: SetupStepStatus[];
  facts: SetupChecklistFacts;
  /** True when every required step is either satisfied, done or skipped. */
  ready: boolean;
}

/** Payload for PATCH /setup/condo/:condoId. */
export const UpdateSetupStepInput = z.object({
  step: SetupStepKey,
  done: z.boolean().optional(),
  skipped: z.boolean().optional(),
});
export type UpdateSetupStepInput = z.infer<typeof UpdateSetupStepInput>;

/** A step is "complete" for progress purposes when satisfied, done or skipped. */
export function isSetupStepComplete(step: SetupStepStatus): boolean {
  return step.satisfied === true || step.done || step.skipped;
}

/** Count of steps a resumed admin has cleared, for progress display. */
export function setupProgress(status: Pick<SetupStatus, 'steps'>): {
  completed: number;
  total: number;
} {
  const actionable = status.steps.filter((s) => s.key !== 'review');
  return {
    completed: actionable.filter(isSetupStepComplete).length,
    total: actionable.length,
  };
}
