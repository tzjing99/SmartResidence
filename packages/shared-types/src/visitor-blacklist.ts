import { z } from 'zod';
import { MalaysiaPhoneSchema } from './phone';

export const VisitorBlacklistSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  idNumber: z.string().nullable().optional(),
  reason: z.string(),
  createdByUserId: z.string().uuid(),
  expiresAt: z.coerce.date().nullable().optional(),
  active: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type VisitorBlacklist = z.infer<typeof VisitorBlacklistSchema>;

const CreateVisitorBlacklistBaseSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: MalaysiaPhoneSchema.optional(),
  vehiclePlate: z.string().max(20).optional(),
  idNumber: z.string().max(60).optional(),
  reason: z.string().min(3).max(500),
  expiresAt: z.coerce.date().optional(),
});

export const CreateVisitorBlacklistSchema = CreateVisitorBlacklistBaseSchema.superRefine(
  (data, ctx) => {
    const hasIdentifier =
      Boolean(data.name?.trim()) ||
      Boolean(data.phone?.trim()) ||
      Boolean(data.vehiclePlate?.trim()) ||
      Boolean(data.idNumber?.trim());
    if (!hasIdentifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one identifier (name, phone, plate, or ID number)',
        path: ['name'],
      });
    }
  },
);
export type CreateVisitorBlacklistInput = z.infer<typeof CreateVisitorBlacklistSchema>;

export const UpdateVisitorBlacklistSchema = CreateVisitorBlacklistBaseSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateVisitorBlacklistInput = z.infer<typeof UpdateVisitorBlacklistSchema>;

/** True when an API error indicates a blacklist block at the gate. */
export function isVisitorBlacklistError(message: string): boolean {
  return message.toLowerCase().includes('blacklist');
}
