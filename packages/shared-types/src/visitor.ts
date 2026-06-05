import { z } from 'zod';

export const VisitorVisitType = z.enum(['PRE_REG', 'WALKIN_UNIT', 'WALKIN_OFFICE']);
export type VisitorVisitType = z.infer<typeof VisitorVisitType>;

export const VisitorStatus = z.enum([
  'PENDING_OWNER_APPROVAL',
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

export const CreateWalkInUnitSchema = z.object({
  unitId: z.string().uuid(),
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  vehiclePlate: z.string().max(20).optional(),
  purpose: z.string().max(200).optional(),
});
export type CreateWalkInUnitInput = z.infer<typeof CreateWalkInUnitSchema>;

export const CreateWalkInOfficeSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  vehiclePlate: z.string().max(20).optional(),
  purpose: z.string().min(3).max(200),
  gateLocation: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
});
export type CreateWalkInOfficeInput = z.infer<typeof CreateWalkInOfficeSchema>;

export const VisitorSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  visitType: VisitorVisitType,
  unitId: z.string().uuid().nullable().optional(),
  hostUserId: z.string().uuid().nullable().optional(),
  name: z.string(),
  identification: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  expectedAt: z.coerce.date(),
  expectedDurationMins: z.number().nullable().optional(),
  qrCode: z.string().nullable().optional(),
  qrPayload: z.string().nullable().optional(),
  accessCode: z.string().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  approvalDeadline: z.coerce.date().nullable().optional(),
  status: VisitorStatus,
  approvedAt: z.coerce.date().nullable().optional(),
  cancelledAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Visitor = z.infer<typeof VisitorSchema>;
