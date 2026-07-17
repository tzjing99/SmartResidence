import { z } from 'zod';

export const ACCESS_RESTRICTION_ERROR_CODE = 'ACCESS_RESTRICTED_ARREARS' as const;

export const AccessRestrictionZone = z.enum(['CAR_PARK', 'AMENITIES', 'COMMON_FACILITIES']);
export type AccessRestrictionZone = z.infer<typeof AccessRestrictionZone>;

export const DEFAULT_ACCESS_RESTRICTION_ZONES: AccessRestrictionZone[] = ['CAR_PARK', 'AMENITIES'];

export const AccessRestrictionSource = z.enum(['AUTO', 'MANUAL']);
export type AccessRestrictionSource = z.infer<typeof AccessRestrictionSource>;

export const AccessRestrictionCapability = z.enum([
  'facility',
  'visitors',
  'deliveryPasses',
  'recurringPasses',
]);
export type AccessRestrictionCapability = z.infer<typeof AccessRestrictionCapability>;

export const CondoAccessRestrictionSettingsSchema = z.object({
  enabled: z.boolean(),
  graceDays: z.number().int().min(0).max(365),
  minOutstanding: z.number().min(0),
  softBlockFacility: z.boolean(),
  softBlockVisitors: z.boolean(),
  softBlockDeliveryPasses: z.boolean(),
  softBlockRecurringPasses: z.boolean(),
  zones: z.array(AccessRestrictionZone).min(1),
  webhookUrl: z.string().url().nullable(),
  /** True when a webhook secret is stored; raw secret is never returned. */
  hasWebhookSecret: z.boolean(),
  autoSyncEnabled: z.boolean(),
});
export type CondoAccessRestrictionSettings = z.infer<typeof CondoAccessRestrictionSettingsSchema>;

export const UpdateCondoAccessRestrictionSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  graceDays: z.number().int().min(0).max(365).optional(),
  minOutstanding: z.number().min(0).optional(),
  softBlockFacility: z.boolean().optional(),
  softBlockVisitors: z.boolean().optional(),
  softBlockDeliveryPasses: z.boolean().optional(),
  softBlockRecurringPasses: z.boolean().optional(),
  zones: z.array(AccessRestrictionZone).min(1).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  /** Pass empty string to clear; omit to leave unchanged. */
  webhookSecret: z.string().max(256).optional(),
  autoSyncEnabled: z.boolean().optional(),
});
export type UpdateCondoAccessRestrictionSettingsInput = z.infer<
  typeof UpdateCondoAccessRestrictionSettingsSchema
>;

export const UnitAccessRestrictionViewSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  unitId: z.string().uuid(),
  unitIdentifier: z.string(),
  blockName: z.string().nullable(),
  active: z.boolean(),
  source: AccessRestrictionSource,
  manualExempt: z.boolean(),
  zones: z.array(AccessRestrictionZone),
  reason: z.string().nullable(),
  outstandingAmount: z.number(),
  oldestDueDate: z.string().datetime().nullable(),
  activatedAt: z.string().datetime().nullable(),
  clearedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type UnitAccessRestrictionView = z.infer<typeof UnitAccessRestrictionViewSchema>;

export const AccessRestrictionUnitListSchema = z.object({
  items: z.array(UnitAccessRestrictionViewSchema),
  total: z.number().int(),
  eligibleArrearsCount: z.number().int(),
});
export type AccessRestrictionUnitList = z.infer<typeof AccessRestrictionUnitListSchema>;

export const AccessRestrictionExportRowSchema = z.object({
  unitId: z.string().uuid(),
  identifier: z.string(),
  block: z.string().nullable(),
  active: z.boolean(),
  source: AccessRestrictionSource,
  zones: z.array(AccessRestrictionZone),
  outstandingAmount: z.number(),
  oldestDueDate: z.string().datetime().nullable(),
  activatedAt: z.string().datetime().nullable(),
  reason: z.string().nullable(),
});
export type AccessRestrictionExportRow = z.infer<typeof AccessRestrictionExportRowSchema>;

export const AccessRestrictionExportPayloadSchema = z.object({
  condoId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  zonesDefault: z.array(AccessRestrictionZone),
  units: z.array(AccessRestrictionExportRowSchema),
});
export type AccessRestrictionExportPayload = z.infer<typeof AccessRestrictionExportPayloadSchema>;

export const ACCESS_RESTRICTION_ZONE_LABELS: Record<AccessRestrictionZone, string> = {
  CAR_PARK: 'Car park',
  AMENITIES: 'Amenities',
  COMMON_FACILITIES: 'Common facilities',
};

/** Resident-safe view of whether a unit is soft-blocked for self-serve flows. */
export const ResidentUnitAccessStatusSchema = z.object({
  unitId: z.string().uuid(),
  condoId: z.string().uuid(),
  /** Policy enabled and unit has an active restriction row. */
  restricted: z.boolean(),
  outstandingAmount: z.number(),
  reason: z.string().nullable(),
  zones: z.array(AccessRestrictionZone),
  blocked: z.object({
    facility: z.boolean(),
    visitors: z.boolean(),
    deliveryPasses: z.boolean(),
    recurringPasses: z.boolean(),
  }),
});
export type ResidentUnitAccessStatus = z.infer<typeof ResidentUnitAccessStatusSchema>;

/** True when an API error / message is the arrears soft-block response. */
export function isAccessRestrictedArrearsError(error: unknown): boolean {
  if (typeof error === 'string') {
    return (
      error.includes(ACCESS_RESTRICTION_ERROR_CODE) || /access restricted/i.test(error)
    );
  }
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: unknown; message?: unknown; body?: unknown };
  if (e.code === ACCESS_RESTRICTION_ERROR_CODE) return true;
  if (typeof e.message === 'string' && isAccessRestrictedArrearsError(e.message)) return true;
  if (e.body && typeof e.body === 'object') {
    return isAccessRestrictedArrearsError(e.body);
  }
  return false;
}
