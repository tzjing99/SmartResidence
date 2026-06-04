import { z } from 'zod';

export const VisitorStatus = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'EXPIRED',
  'CANCELLED',
]);
export type VisitorStatus = z.infer<typeof VisitorStatus>;

export const CreateVisitorSchema = z.object({
  unitId: z.string().uuid(),
  name: z.string().min(2).max(120),
  identification: z.string().max(60).optional(),
  phone: z.string().max(30).optional(),
  vehiclePlate: z.string().max(20).optional(),
  purpose: z.string().max(200).optional(),
  expectedAt: z.coerce.date(),
  expectedDurationMins: z.number().int().min(1).optional(),
});
export type CreateVisitorInput = z.infer<typeof CreateVisitorSchema>;

export const VisitorSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  unitId: z.string().uuid(),
  hostUserId: z.string().uuid(),
  name: z.string(),
  identification: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  expectedAt: z.coerce.date(),
  expectedDurationMins: z.number().nullable().optional(),
  qrCode: z.string(),
  status: VisitorStatus,
  approvedAt: z.coerce.date().nullable().optional(),
  cancelledAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Visitor = z.infer<typeof VisitorSchema>;
