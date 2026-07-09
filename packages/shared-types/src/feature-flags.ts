import { z } from 'zod';

/**
 * Platform-managed feature flags for a condo.
 * Stored under `Condo.settings.featureFlags` (JSON); ML keys also sync to
 * existing helpdesk settings so current consumers keep working.
 */
export const PLATFORM_FEATURE_FLAG_KEYS = [
  'helpdeskMlAssignee',
  'helpdeskMlPriority',
  'whatsappNotifications',
  'residentAiAssist',
] as const;

export type PlatformFeatureFlagKey = (typeof PLATFORM_FEATURE_FLAG_KEYS)[number];

export interface PlatformFeatureFlagDefinition {
  key: PlatformFeatureFlagKey;
  label: string;
  description: string;
  /** Default when unset (all opt-in flags default off). */
  defaultEnabled: boolean;
}

export const PLATFORM_FEATURE_FLAG_CATALOG: readonly PlatformFeatureFlagDefinition[] = [
  {
    key: 'helpdeskMlAssignee',
    label: 'Helpdesk ML assignee suggestions',
    description:
      'Opt-in ML assignee suggestions once enough closed threads exist (C6). Rules remain the fallback.',
    defaultEnabled: false,
  },
  {
    key: 'helpdeskMlPriority',
    label: 'Helpdesk ML priority suggestions',
    description:
      'Opt-in ML priority suggestions for new threads (C6). Deterministic rules remain the fallback.',
    defaultEnabled: false,
  },
  {
    key: 'whatsappNotifications',
    label: 'WhatsApp notifications',
    description:
      'Allow condo-level WhatsApp outbound notifications when credentials are configured.',
    defaultEnabled: false,
  },
  {
    key: 'residentAiAssist',
    label: 'Resident AI assist',
    description: 'Expose the pluggable AI assist seam to residents for this condo.',
    defaultEnabled: false,
  },
] as const;

export type PlatformFeatureFlagsMap = Record<PlatformFeatureFlagKey, boolean>;

export interface PlatformFeatureFlagState {
  key: PlatformFeatureFlagKey;
  label: string;
  description: string;
  enabled: boolean;
  defaultEnabled: boolean;
}

export interface PlatformCondoFeatureFlags {
  condoId: string;
  flags: PlatformFeatureFlagState[];
}

export const UpdatePlatformFeatureFlagsBody = z
  .object({
    helpdeskMlAssignee: z.boolean().optional(),
    helpdeskMlPriority: z.boolean().optional(),
    whatsappNotifications: z.boolean().optional(),
    residentAiAssist: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => typeof x === 'boolean'), {
    message: 'At least one feature flag must be provided',
  });

export type UpdatePlatformFeatureFlagsBody = z.infer<typeof UpdatePlatformFeatureFlagsBody>;

export function defaultPlatformFeatureFlags(): PlatformFeatureFlagsMap {
  return {
    helpdeskMlAssignee: false,
    helpdeskMlPriority: false,
    whatsappNotifications: false,
    residentAiAssist: false,
  };
}

export function isPlatformFeatureFlagKey(value: string): value is PlatformFeatureFlagKey {
  return (PLATFORM_FEATURE_FLAG_KEYS as readonly string[]).includes(value);
}
