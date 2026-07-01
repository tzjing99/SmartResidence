import { z } from 'zod';

export const PollStatus = z.enum(['DRAFT', 'OPEN', 'CLOSED']);
export type PollStatus = z.infer<typeof PollStatus>;

export const POLL_STATUS_LABELS: Record<PollStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  CLOSED: 'Closed',
};

export const PollAudienceScope = z.enum(['ALL_OWNERS', 'BLOCK']);
export type PollAudienceScope = z.infer<typeof PollAudienceScope>;

export const POLL_AUDIENCE_LABELS: Record<PollAudienceScope, string> = {
  ALL_OWNERS: 'All owners',
  BLOCK: 'Specific blocks',
};

export const PollOptionSchema = z.object({
  id: z.string().uuid(),
  pollId: z.string().uuid().optional(),
  label: z.string(),
  position: z.number().int(),
});
export type PollOption = z.infer<typeof PollOptionSchema>;

export const PollOptionResultSchema = PollOptionSchema.extend({
  voteCount: z.number().int(),
  weightSum: z.number(),
  votePercent: z.number(),
  weightPercent: z.number(),
});
export type PollOptionResult = z.infer<typeof PollOptionResultSchema>;

export const PollVoteBreakdownSchema = z.object({
  unitId: z.string().uuid(),
  unitIdentifier: z.string(),
  optionId: z.string().uuid(),
  optionLabel: z.string(),
  weight: z.number(),
  votedAt: z.coerce.date(),
});
export type PollVoteBreakdown = z.infer<typeof PollVoteBreakdownSchema>;

export const PollResultsSchema = z.object({
  totalVotes: z.number().int(),
  totalWeight: z.number(),
  options: z.array(PollOptionResultSchema),
  breakdown: z.array(PollVoteBreakdownSchema).optional(),
});
export type PollResults = z.infer<typeof PollResultsSchema>;

export const PollMyVoteSchema = z.object({
  unitId: z.string().uuid(),
  unitIdentifier: z.string(),
  optionId: z.string().uuid(),
  optionLabel: z.string(),
  weight: z.number(),
  votedAt: z.coerce.date(),
});
export type PollMyVote = z.infer<typeof PollMyVoteSchema>;

export const PollSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: PollStatus,
  opensAt: z.coerce.date().nullable().optional(),
  closesAt: z.coerce.date().nullable().optional(),
  audienceScope: PollAudienceScope,
  blockIds: z.array(z.string().uuid()).optional(),
  settings: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  createdBy: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  options: z.array(PollOptionSchema).optional(),
  results: PollResultsSchema.nullable().optional(),
  myVotes: z.array(PollMyVoteSchema).optional(),
});
export type Poll = z.infer<typeof PollSchema>;

export const CreatePollInputSchema = z.object({
  condoId: z.string().uuid(),
  title: z.string().min(4).max(200),
  description: z.string().min(1),
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
  audienceScope: PollAudienceScope.optional(),
  blockIds: z.array(z.string().uuid()).optional(),
  settings: z.record(z.unknown()).optional(),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        position: z.number().int().optional(),
      }),
    )
    .min(2)
    .max(10),
});
export type CreatePollInput = z.infer<typeof CreatePollInputSchema>;

export const UpdatePollInputSchema = z.object({
  title: z.string().min(4).max(200).optional(),
  description: z.string().min(1).optional(),
  opensAt: z.coerce.date().nullable().optional(),
  closesAt: z.coerce.date().nullable().optional(),
  audienceScope: PollAudienceScope.optional(),
  blockIds: z.array(z.string().uuid()).optional(),
  settings: z.record(z.unknown()).optional(),
  status: PollStatus.optional(),
  options: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        label: z.string().min(1).max(200),
        position: z.number().int().optional(),
      }),
    )
    .min(2)
    .max(10)
    .optional(),
});
export type UpdatePollInput = z.infer<typeof UpdatePollInputSchema>;

export const CastPollVoteInputSchema = z.object({
  unitId: z.string().uuid(),
  optionId: z.string().uuid(),
});
export type CastPollVoteInput = z.infer<typeof CastPollVoteInputSchema>;

/** Effective poll status considering auto-close when closesAt has passed. */
export function effectivePollStatus(
  poll: { status: PollStatus; closesAt?: Date | string | null },
  now: Date = new Date(),
): PollStatus {
  if (
    poll.status === 'OPEN' &&
    poll.closesAt &&
    new Date(poll.closesAt).getTime() <= now.getTime()
  ) {
    return 'CLOSED';
  }
  return poll.status;
}
