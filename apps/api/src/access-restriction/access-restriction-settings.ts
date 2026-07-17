import {
  type AccessRestrictionZone,
  type CondoAccessRestrictionSettings,
  DEFAULT_ACCESS_RESTRICTION_ZONES,
} from '@smartresidence/shared-types';

const ZONE_SET = new Set<string>(['CAR_PARK', 'AMENITIES', 'COMMON_FACILITIES']);

export type StoredAccessRestrictionSettings = {
  enabled: boolean;
  graceDays: number;
  minOutstanding: number;
  softBlockFacility: boolean;
  softBlockVisitors: boolean;
  softBlockDeliveryPasses: boolean;
  softBlockRecurringPasses: boolean;
  zones: AccessRestrictionZone[];
  webhookUrl: string | null;
  webhookSecret: string | null;
  autoSyncEnabled: boolean;
};

export const DEFAULT_ACCESS_RESTRICTION_SETTINGS: StoredAccessRestrictionSettings = {
  enabled: false,
  graceDays: 14,
  minOutstanding: 0.01,
  softBlockFacility: true,
  softBlockVisitors: true,
  softBlockDeliveryPasses: true,
  softBlockRecurringPasses: true,
  zones: [...DEFAULT_ACCESS_RESTRICTION_ZONES],
  webhookUrl: null,
  webhookSecret: null,
  autoSyncEnabled: false,
};

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseNonNegNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function parseGraceDays(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 365
    ? value
    : fallback;
}

function parseZones(value: unknown, fallback: AccessRestrictionZone[]): AccessRestrictionZone[] {
  if (!Array.isArray(value)) return [...fallback];
  const zones = value.filter(
    (z): z is AccessRestrictionZone => typeof z === 'string' && ZONE_SET.has(z),
  );
  return zones.length > 0 ? zones : [...fallback];
}

function parseUrl(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function parseSecret(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 256) : null;
}

export function parseAccessRestrictionSettings(raw: unknown): StoredAccessRestrictionSettings {
  const root =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const nested =
    root.accessRestriction && typeof root.accessRestriction === 'object'
      ? (root.accessRestriction as Record<string, unknown>)
      : {};

  return {
    enabled: parseBoolean(nested.enabled, DEFAULT_ACCESS_RESTRICTION_SETTINGS.enabled),
    graceDays: parseGraceDays(nested.graceDays, DEFAULT_ACCESS_RESTRICTION_SETTINGS.graceDays),
    minOutstanding: parseNonNegNumber(
      nested.minOutstanding,
      DEFAULT_ACCESS_RESTRICTION_SETTINGS.minOutstanding,
    ),
    softBlockFacility: parseBoolean(
      nested.softBlockFacility,
      DEFAULT_ACCESS_RESTRICTION_SETTINGS.softBlockFacility,
    ),
    softBlockVisitors: parseBoolean(
      nested.softBlockVisitors,
      DEFAULT_ACCESS_RESTRICTION_SETTINGS.softBlockVisitors,
    ),
    softBlockDeliveryPasses: parseBoolean(
      nested.softBlockDeliveryPasses,
      DEFAULT_ACCESS_RESTRICTION_SETTINGS.softBlockDeliveryPasses,
    ),
    softBlockRecurringPasses: parseBoolean(
      nested.softBlockRecurringPasses,
      DEFAULT_ACCESS_RESTRICTION_SETTINGS.softBlockRecurringPasses,
    ),
    zones: parseZones(nested.zones, DEFAULT_ACCESS_RESTRICTION_SETTINGS.zones),
    webhookUrl: parseUrl(nested.webhookUrl),
    webhookSecret: parseSecret(nested.webhookSecret),
    autoSyncEnabled: parseBoolean(
      nested.autoSyncEnabled,
      DEFAULT_ACCESS_RESTRICTION_SETTINGS.autoSyncEnabled,
    ),
  };
}

export function toPublicAccessRestrictionSettings(
  stored: StoredAccessRestrictionSettings,
): CondoAccessRestrictionSettings {
  return {
    enabled: stored.enabled,
    graceDays: stored.graceDays,
    minOutstanding: stored.minOutstanding,
    softBlockFacility: stored.softBlockFacility,
    softBlockVisitors: stored.softBlockVisitors,
    softBlockDeliveryPasses: stored.softBlockDeliveryPasses,
    softBlockRecurringPasses: stored.softBlockRecurringPasses,
    zones: stored.zones,
    webhookUrl: stored.webhookUrl,
    hasWebhookSecret: Boolean(stored.webhookSecret),
    autoSyncEnabled: stored.autoSyncEnabled,
  };
}

export function mergeAccessRestrictionSettings(
  condoSettings: unknown,
  next: StoredAccessRestrictionSettings,
): Record<string, unknown> {
  const root =
    condoSettings && typeof condoSettings === 'object' && !Array.isArray(condoSettings)
      ? { ...(condoSettings as Record<string, unknown>) }
      : {};
  root.accessRestriction = {
    enabled: next.enabled,
    graceDays: next.graceDays,
    minOutstanding: next.minOutstanding,
    softBlockFacility: next.softBlockFacility,
    softBlockVisitors: next.softBlockVisitors,
    softBlockDeliveryPasses: next.softBlockDeliveryPasses,
    softBlockRecurringPasses: next.softBlockRecurringPasses,
    zones: next.zones,
    webhookUrl: next.webhookUrl,
    webhookSecret: next.webhookSecret,
    autoSyncEnabled: next.autoSyncEnabled,
  };
  return root;
}
