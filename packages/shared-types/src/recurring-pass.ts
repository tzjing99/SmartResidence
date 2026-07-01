import { z } from 'zod';
import { MalaysiaPhoneSchema } from './phone';

export const RecurringPassTimeWindowSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format'),
});
export type RecurringPassTimeWindow = z.infer<typeof RecurringPassTimeWindowSchema>;

export const RecurringPassScheduleSchema = z.object({
  /** ISO weekday 1=Mon … 7=Sun */
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1),
  timeWindow: RecurringPassTimeWindowSchema,
});
export type RecurringPassSchedule = z.infer<typeof RecurringPassScheduleSchema>;

export const RecurringPassSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  unitId: z.string().uuid(),
  hostUserId: z.string().uuid(),
  guestName: z.string(),
  guestPhone: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  schedule: RecurringPassScheduleSchema,
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  accessCode: z.string().nullable().optional(),
  qrPayload: z.string().nullable().optional(),
  active: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type RecurringPass = z.infer<typeof RecurringPassSchema>;

const CreateRecurringPassBaseSchema = z.object({
  unitId: z.string().uuid(),
  guestName: z.string().min(2).max(120),
  guestPhone: MalaysiaPhoneSchema.optional(),
  vehiclePlate: z.string().max(20).optional(),
  schedule: RecurringPassScheduleSchema,
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});

export const CreateRecurringPassSchema = CreateRecurringPassBaseSchema.superRefine((data, ctx) => {
  if (data.validUntil <= data.validFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Valid until must be after valid from',
      path: ['validUntil'],
    });
  }
  const { start, end } = data.schedule.timeWindow;
  if (start >= end) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Time window end must be after start',
      path: ['schedule', 'timeWindow', 'end'],
    });
  }
});
export type CreateRecurringPassInput = z.infer<typeof CreateRecurringPassSchema>;

export const UpdateRecurringPassSchema = CreateRecurringPassBaseSchema.omit({ unitId: true })
  .partial()
  .extend({ active: z.boolean().optional() });
export type UpdateRecurringPassInput = z.infer<typeof UpdateRecurringPassSchema>;

export const RecurringPassVerifySchema = z.object({
  passType: z.literal('recurring'),
  id: z.string().uuid(),
  guestName: z.string(),
  guestPhone: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  accessCode: z.string().nullable().optional(),
  unitLabel: z.string().nullable(),
  schedule: RecurringPassScheduleSchema,
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  withinSchedule: z.boolean(),
  scheduleMessage: z.string().optional(),
});
export type RecurringPassVerify = z.infer<typeof RecurringPassVerifySchema>;

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

export function formatRecurringScheduleSummary(schedule: RecurringPassSchedule): string {
  const days = [...schedule.daysOfWeek].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d] ?? d);
  return `${days.join(', ')} · ${schedule.timeWindow.start}–${schedule.timeWindow.end}`;
}
