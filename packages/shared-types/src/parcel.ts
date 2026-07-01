import { z } from 'zod';

export const ParcelStatus = z.enum(['RECEIVED', 'NOTIFIED', 'COLLECTED', 'OVERDUE']);
export type ParcelStatus = z.infer<typeof ParcelStatus>;

export const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  RECEIVED: 'Received',
  NOTIFIED: 'Awaiting collection',
  COLLECTED: 'Collected',
  OVERDUE: 'Overdue',
};

/** Default days before an uncollected parcel is flagged overdue. */
export const PARCEL_OVERDUE_DAYS = 3;

export const ParcelSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  unitId: z.string().uuid(),
  recipientName: z.string(),
  carrier: z.string().nullable().optional(),
  trackingRef: z.string().nullable().optional(),
  status: ParcelStatus,
  receivedAt: z.coerce.date(),
  collectedAt: z.coerce.date().nullable().optional(),
  receivedByGuardId: z.string().uuid(),
  collectedByUserId: z.string().uuid().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lastOverdueNotifiedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  unit: z
    .object({
      id: z.string().uuid(),
      identifier: z.string(),
      block: z.object({ name: z.string() }).nullable().optional(),
    })
    .nullable()
    .optional(),
  receivedByGuard: z.object({ id: z.string().uuid(), name: z.string() }).nullable().optional(),
  collectedBy: z.object({ id: z.string().uuid(), name: z.string() }).nullable().optional(),
});
export type Parcel = z.infer<typeof ParcelSchema>;

export const CreateParcelInputSchema = z.object({
  condoId: z.string().uuid(),
  unitId: z.string().uuid(),
  recipientName: z.string().min(1).max(120),
  carrier: z.string().max(80).optional(),
  trackingRef: z.string().max(120).optional(),
  photoUrl: z.string().max(2000).optional(),
  notes: z.string().max(1000).optional(),
});
export type CreateParcelInput = z.infer<typeof CreateParcelInputSchema>;

export const CollectParcelInputSchema = z.object({
  notes: z.string().max(1000).optional(),
});
export type CollectParcelInput = z.infer<typeof CollectParcelInputSchema>;
