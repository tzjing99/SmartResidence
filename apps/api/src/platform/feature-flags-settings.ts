import { mergeHelpdeskSettings, parseHelpdeskSettings } from '@/sla/helpdesk-settings';
import {
  PLATFORM_FEATURE_FLAG_CATALOG,
  PLATFORM_FEATURE_FLAG_KEYS,
  type PlatformCondoFeatureFlags,
  type PlatformFeatureFlagKey,
  type PlatformFeatureFlagsMap,
  defaultPlatformFeatureFlags,
} from '@smartresidence/shared-types';

function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function readStoredFlags(raw: unknown): Partial<PlatformFeatureFlagsMap> {
  const settings = asObject(raw);
  const stored = asObject(settings.featureFlags);
  const out: Partial<PlatformFeatureFlagsMap> = {};
  for (const key of PLATFORM_FEATURE_FLAG_KEYS) {
    if (typeof stored[key] === 'boolean') {
      out[key] = stored[key];
    }
  }
  return out;
}

/**
 * Resolve effective flags for a condo.
 * ML keys prefer existing helpdesk settings when present so helpdesk UI and
 * platform console stay aligned.
 */
export function resolvePlatformFeatureFlags(
  condoId: string,
  condoSettings: unknown,
): PlatformCondoFeatureFlags {
  const defaults = defaultPlatformFeatureFlags();
  const stored = readStoredFlags(condoSettings);
  const helpdesk = parseHelpdeskSettings(condoSettings);

  const resolved: PlatformFeatureFlagsMap = {
    ...defaults,
    ...stored,
    helpdeskMlAssignee:
      helpdesk.autoAssignment?.mlEnabled ??
      stored.helpdeskMlAssignee ??
      defaults.helpdeskMlAssignee,
    helpdeskMlPriority:
      helpdesk.mlPriorityEnabled ?? stored.helpdeskMlPriority ?? defaults.helpdeskMlPriority,
  };

  return {
    condoId,
    flags: PLATFORM_FEATURE_FLAG_CATALOG.map((def) => ({
      key: def.key,
      label: def.label,
      description: def.description,
      defaultEnabled: def.defaultEnabled,
      enabled: resolved[def.key],
    })),
  };
}

export function mergePlatformFeatureFlags(
  existingSettings: unknown,
  patch: Partial<PlatformFeatureFlagsMap>,
): Record<string, unknown> {
  const current = resolvePlatformFeatureFlags('unused', existingSettings);
  const nextMap: PlatformFeatureFlagsMap = {
    ...defaultPlatformFeatureFlags(),
    ...Object.fromEntries(current.flags.map((f) => [f.key, f.enabled])),
    ...patch,
  } as PlatformFeatureFlagsMap;

  let settings = asObject(existingSettings);
  settings = {
    ...settings,
    featureFlags: nextMap,
  };

  // Keep helpdesk ML toggles in sync for existing consumers.
  if (
    typeof patch.helpdeskMlAssignee === 'boolean' ||
    typeof patch.helpdeskMlPriority === 'boolean'
  ) {
    const helpdesk = parseHelpdeskSettings(settings);
    const autoAssignment = {
      generalTriagePool: helpdesk.autoAssignment?.generalTriagePool ?? [],
      categoryPools: helpdesk.autoAssignment?.categoryPools ?? [],
      seniorStaffPool: helpdesk.autoAssignment?.seniorStaffPool ?? [],
      priorityPools: helpdesk.autoAssignment?.priorityPools,
      mlEnabled:
        typeof patch.helpdeskMlAssignee === 'boolean'
          ? patch.helpdeskMlAssignee
          : (helpdesk.autoAssignment?.mlEnabled ?? nextMap.helpdeskMlAssignee),
    };
    settings = mergeHelpdeskSettings(settings, {
      autoAssignment,
      mlPriorityEnabled:
        typeof patch.helpdeskMlPriority === 'boolean'
          ? patch.helpdeskMlPriority
          : helpdesk.mlPriorityEnabled,
    });
  }

  return settings;
}

export function changedFlagKeys(
  before: PlatformCondoFeatureFlags,
  after: PlatformCondoFeatureFlags,
): PlatformFeatureFlagKey[] {
  const beforeMap = new Map(before.flags.map((f) => [f.key, f.enabled]));
  return after.flags.filter((f) => beforeMap.get(f.key) !== f.enabled).map((f) => f.key);
}
