import { z } from 'zod';

// -- Panic / SOS ------------------------------------------------------

export const SosKind = z.enum(['MEDICAL', 'SECURITY', 'FIRE', 'GENERAL']);
export type SosKind = z.infer<typeof SosKind>;

export const SOS_KIND_LABELS: Record<SosKind, string> = {
  MEDICAL: 'Medical',
  SECURITY: 'Security',
  FIRE: 'Fire',
  GENERAL: 'General',
};

export const SosStatus = z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED']);
export type SosStatus = z.infer<typeof SosStatus>;

export const SOS_STATUS_LABELS: Record<SosStatus, string> = {
  ACTIVE: 'Active',
  ACKNOWLEDGED: 'Help on the way',
  RESOLVED: 'Resolved',
  CANCELLED: 'Cancelled',
};

/** An SOS alert is still open (needs attention) while ACTIVE or ACKNOWLEDGED. */
export function isSosOpen(status: SosStatus): boolean {
  return status === 'ACTIVE' || status === 'ACKNOWLEDGED';
}

const SosPersonSchema = z.object({ id: z.string().uuid(), name: z.string() }).nullable().optional();

export const SosAlertSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  raisedByUserId: z.string().uuid(),
  unitId: z.string().uuid().nullable().optional(),
  kind: SosKind,
  status: SosStatus,
  locationNote: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  acknowledgedByUserId: z.string().uuid().nullable().optional(),
  acknowledgedAt: z.coerce.date().nullable().optional(),
  resolvedByUserId: z.string().uuid().nullable().optional(),
  resolvedAt: z.coerce.date().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
  cancelledAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  raisedBy: SosPersonSchema,
  acknowledgedBy: SosPersonSchema,
  resolvedBy: SosPersonSchema,
  unit: z.object({ id: z.string().uuid(), identifier: z.string() }).nullable().optional(),
});
export type SosAlert = z.infer<typeof SosAlertSchema>;

export const RaiseSosInputSchema = z.object({
  condoId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  kind: SosKind.optional(),
  locationNote: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type RaiseSosInput = z.infer<typeof RaiseSosInputSchema>;

export const ResolveSosInputSchema = z.object({
  resolutionNote: z.string().max(1000).optional(),
});
export type ResolveSosInput = z.infer<typeof ResolveSosInputSchema>;

export const SosCondoResponseSchema = z.object({
  active: z.array(SosAlertSchema),
  recent: z.array(SosAlertSchema),
});
export type SosCondoResponse = z.infer<typeof SosCondoResponseSchema>;

// -- Guard patrol / QR-checkpoint tours -------------------------------

export const PatrolScanSource = z.enum(['ONLINE', 'OFFLINE']);
export type PatrolScanSource = z.infer<typeof PatrolScanSource>;

export const PatrolCheckpointSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  code: z.string(),
  active: z.boolean(),
  position: z.number().int(),
  expectedIntervalMinutes: z.number().int().nullable().optional(),
  lastOverdueNotifiedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type PatrolCheckpoint = z.infer<typeof PatrolCheckpointSchema>;

/** A checkpoint enriched with its patrol status for management dashboards. */
export const PatrolCheckpointStatusSchema = PatrolCheckpointSchema.extend({
  lastScanAt: z.coerce.date().nullable().optional(),
  lastScanGuardName: z.string().nullable().optional(),
  /** Scans recorded so far in the current local day. */
  scansToday: z.number().int(),
  /** True when an active checkpoint has not been scanned within its interval. */
  overdue: z.boolean(),
});
export type PatrolCheckpointStatus = z.infer<typeof PatrolCheckpointStatusSchema>;

export const PatrolScanSchema = z.object({
  id: z.string().uuid(),
  checkpointId: z.string().uuid(),
  condoId: z.string().uuid(),
  guardUserId: z.string().uuid(),
  scannedAt: z.coerce.date(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
  source: PatrolScanSource,
  createdAt: z.coerce.date().optional(),
  checkpoint: z.object({ id: z.string().uuid(), name: z.string() }).nullable().optional(),
  guard: z.object({ id: z.string().uuid(), name: z.string() }).nullable().optional(),
});
export type PatrolScan = z.infer<typeof PatrolScanSchema>;

export const CreatePatrolCheckpointInputSchema = z.object({
  condoId: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  active: z.boolean().optional(),
  position: z.number().int().optional(),
  expectedIntervalMinutes: z.number().int().min(5).max(1440).optional(),
});
export type CreatePatrolCheckpointInput = z.infer<typeof CreatePatrolCheckpointInputSchema>;

export const UpdatePatrolCheckpointInputSchema = CreatePatrolCheckpointInputSchema.partial().omit({
  condoId: true,
});
export type UpdatePatrolCheckpointInput = z.infer<typeof UpdatePatrolCheckpointInputSchema>;

export const PatrolScanInputSchema = z.object({
  /** The QR token value scanned from the checkpoint. */
  code: z.string().min(1),
  note: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  source: PatrolScanSource.optional(),
  /** Client capture time (for offline scans synced later). */
  scannedAt: z.coerce.date().optional(),
});
export type PatrolScanInput = z.infer<typeof PatrolScanInputSchema>;
