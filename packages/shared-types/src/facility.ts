import { z } from 'zod';

export const BookingStatus = z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED']);
export type BookingStatus = z.infer<typeof BookingStatus>;

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Awaiting approval',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

/** Validate a 24h HH:mm string (e.g. "08:00", "22:30"). */
export const HHmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm (24h) format');

export const FacilitySchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  capacity: z.number().int().nullable().optional(),
  requiresApproval: z.boolean(),
  bookingFee: z.number().nullable().optional(),
  depositAmount: z.number().nullable().optional(),
  openTime: z.string(),
  closeTime: z.string(),
  slotMinutes: z.number().int(),
  maxConcurrent: z.number().int(),
  active: z.boolean(),
  position: z.number().int(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type Facility = z.infer<typeof FacilitySchema>;

export const BookingSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),
  condoId: z.string().uuid(),
  unitId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  status: BookingStatus,
  fee: z.number(),
  depositHeld: z.number(),
  invoiceId: z.string().uuid().nullable().optional(),
  depositId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  reviewedByUserId: z.string().uuid().nullable().optional(),
  reviewedAt: z.coerce.date().nullable().optional(),
  cancelledAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  facility: FacilitySchema.partial().optional(),
  unit: z.object({ id: z.string().uuid(), identifier: z.string() }).nullable().optional(),
  user: z.object({ id: z.string().uuid(), name: z.string() }).nullable().optional(),
});
export type Booking = z.infer<typeof BookingSchema>;

/** One bookable slot within a facility's daily window. */
export const AvailabilitySlotSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  /** Confirmed/pending bookings already taking this slot. */
  booked: z.number().int(),
  /** Remaining concurrent capacity (0 = full). */
  remaining: z.number().int(),
  available: z.boolean(),
});
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

export const FacilityAvailabilitySchema = z.object({
  facilityId: z.string().uuid(),
  date: z.string(),
  slotMinutes: z.number().int(),
  maxConcurrent: z.number().int(),
  slots: z.array(AvailabilitySlotSchema),
});
export type FacilityAvailability = z.infer<typeof FacilityAvailabilitySchema>;

export const CreateFacilityInputSchema = z.object({
  condoId: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  capacity: z.number().int().positive().optional(),
  requiresApproval: z.boolean().optional(),
  bookingFee: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  openTime: HHmm.optional(),
  closeTime: HHmm.optional(),
  slotMinutes: z.number().int().min(15).max(1440).optional(),
  maxConcurrent: z.number().int().min(1).max(100).optional(),
  active: z.boolean().optional(),
  position: z.number().int().optional(),
});
export type CreateFacilityInput = z.infer<typeof CreateFacilityInputSchema>;

export const UpdateFacilityInputSchema = CreateFacilityInputSchema.partial().omit({
  condoId: true,
});
export type UpdateFacilityInput = z.infer<typeof UpdateFacilityInputSchema>;

export const CreateBookingInputSchema = z.object({
  facilityId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  notes: z.string().max(1000).optional(),
});
export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>;

/** Minutes-since-midnight for a 24h HH:mm string ("08:30" → 510). */
export function hhmmToMinutes(hhmm: string): number {
  const parts = hhmm.split(':');
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

/** True when two [start,end) intervals overlap. */
export function bookingsOverlap(
  a: { startAt: Date | string; endAt: Date | string },
  b: { startAt: Date | string; endAt: Date | string },
): boolean {
  return (
    new Date(a.startAt).getTime() < new Date(b.endAt).getTime() &&
    new Date(a.endAt).getTime() > new Date(b.startAt).getTime()
  );
}
