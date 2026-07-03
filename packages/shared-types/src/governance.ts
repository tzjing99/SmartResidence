import { z } from 'zod';
import { FundBalanceSchema, LedgerFund } from './billing';
import { PollMyVoteSchema, PollResultsSchema, PollSchema } from './polls';

export const GeneralMeetingKind = z.enum(['AGM', 'EGM']);
export type GeneralMeetingKind = z.infer<typeof GeneralMeetingKind>;

export const MEETING_KIND_LABELS: Record<GeneralMeetingKind, string> = {
  AGM: 'Annual General Meeting',
  EGM: 'Extraordinary General Meeting',
};

export const GeneralMeetingStatus = z.enum(['DRAFT', 'NOTICE_PUBLISHED', 'IN_PROGRESS', 'CLOSED']);
export type GeneralMeetingStatus = z.infer<typeof GeneralMeetingStatus>;

export const MEETING_STATUS_LABELS: Record<GeneralMeetingStatus, string> = {
  DRAFT: 'Draft',
  NOTICE_PUBLISHED: 'Notice published',
  IN_PROGRESS: 'In progress',
  CLOSED: 'Closed',
};

/** Fund balances captured when the meeting notice is published (AGM disclosure). */
export const MeetingFinancialSnapshotSchema = z.object({
  capturedAt: z.coerce.date(),
  fundBalances: z.array(FundBalanceSchema),
});
export type MeetingFinancialSnapshot = z.infer<typeof MeetingFinancialSnapshotSchema>;

export { LedgerFund };

export const MeetingProxySchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  unitId: z.string().uuid(),
  unitIdentifier: z.string().optional(),
  proxyHolderUserId: z.string().uuid().nullable().optional(),
  proxyHolderName: z.string(),
  proxyHolderContact: z.string().optional(),
  submittedAt: z.coerce.date(),
});
export type MeetingProxy = z.infer<typeof MeetingProxySchema>;

export const MeetingProxyAdminSchema = MeetingProxySchema.extend({
  ownerUserId: z.string().uuid(),
  ownerName: z.string(),
  ownerEmail: z.string(),
  proxyHolderAccountName: z.string().nullable().optional(),
});
export type MeetingProxyAdmin = z.infer<typeof MeetingProxyAdminSchema>;

export const MeetingProxyAssignmentSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  unitId: z.string().uuid(),
  unitIdentifier: z.string().optional(),
  ownerUserId: z.string().uuid(),
  ownerName: z.string(),
  proxyHolderName: z.string(),
  submittedAt: z.coerce.date(),
});
export type MeetingProxyAssignment = z.infer<typeof MeetingProxyAssignmentSchema>;

export const MeetingResolutionPollSummarySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED']),
  opensAt: z.coerce.date().nullable().optional(),
  closesAt: z.coerce.date().nullable().optional(),
  options: PollSchema.shape.options,
  results: PollResultsSchema.nullable().optional(),
  myVotes: z.array(PollMyVoteSchema).optional(),
});

export const MeetingResolutionSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  pollId: z.string().uuid().nullable().optional(),
  votingOpensAt: z.coerce.date().nullable().optional(),
  votingClosesAt: z.coerce.date().nullable().optional(),
  position: z.number().int().optional(),
  poll: MeetingResolutionPollSummarySchema.nullable().optional(),
  resultsSnapshot: PollResultsSchema.nullable().optional(),
});
export type MeetingResolution = z.infer<typeof MeetingResolutionSchema>;

export const GeneralMeetingSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  kind: GeneralMeetingKind,
  title: z.string(),
  scheduledAt: z.coerce.date(),
  noticeBody: z.string().optional(),
  minutesBody: z.string().optional(),
  minutesPublishedAt: z.coerce.date().nullable().optional(),
  financialSnapshot: MeetingFinancialSnapshotSchema.nullable().optional(),
  status: GeneralMeetingStatus,
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  createdBy: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  resolutionCount: z.number().int().optional(),
  proxyCount: z.number().int().optional(),
  resolutions: z.array(MeetingResolutionSchema).optional(),
  myProxies: z.array(MeetingProxySchema).optional(),
  myProxyAssignments: z.array(MeetingProxyAssignmentSchema).optional(),
});
export type GeneralMeeting = z.infer<typeof GeneralMeetingSchema>;

export const CreateGeneralMeetingInputSchema = z.object({
  condoId: z.string().uuid(),
  kind: GeneralMeetingKind,
  title: z.string().min(4).max(200),
  scheduledAt: z.coerce.date(),
  noticeBody: z.string().optional(),
});
export type CreateGeneralMeetingInput = z.infer<typeof CreateGeneralMeetingInputSchema>;

export const UpdateGeneralMeetingInputSchema = z.object({
  kind: GeneralMeetingKind.optional(),
  title: z.string().min(4).max(200).optional(),
  scheduledAt: z.coerce.date().optional(),
  noticeBody: z.string().optional(),
  minutesBody: z.string().optional(),
  status: GeneralMeetingStatus.optional(),
});
export type UpdateGeneralMeetingInput = z.infer<typeof UpdateGeneralMeetingInputSchema>;

export const PublishMeetingMinutesInputSchema = z.object({
  minutesBody: z.string().optional(),
});
export type PublishMeetingMinutesInput = z.infer<typeof PublishMeetingMinutesInputSchema>;

export const CreateMeetingResolutionInputSchema = z.object({
  title: z.string().min(4).max(200),
  description: z.string().optional(),
  position: z.number().int().optional(),
});
export type CreateMeetingResolutionInput = z.infer<typeof CreateMeetingResolutionInputSchema>;

export const UpdateMeetingResolutionInputSchema = CreateMeetingResolutionInputSchema.partial();
export type UpdateMeetingResolutionInput = z.infer<typeof UpdateMeetingResolutionInputSchema>;

export const OpenResolutionVotingInputSchema = z.object({
  votingOpensAt: z.coerce.date().optional(),
  votingClosesAt: z.coerce.date().optional(),
});
export type OpenResolutionVotingInput = z.infer<typeof OpenResolutionVotingInputSchema>;

export const SubmitMeetingProxyInputSchema = z.object({
  unitId: z.string().uuid(),
  proxyHolderName: z.string().min(2).max(120),
  proxyHolderContact: z.string().max(120).optional(),
  proxyHolderUserId: z.string().uuid().optional(),
});
export type SubmitMeetingProxyInput = z.infer<typeof SubmitMeetingProxyInputSchema>;

export const CastResolutionVoteInputSchema = z.object({
  unitId: z.string().uuid(),
  optionId: z.string().uuid(),
});
export type CastResolutionVoteInput = z.infer<typeof CastResolutionVoteInputSchema>;

export const ResolutionResultsSchema = z.object({
  resolutionId: z.string().uuid(),
  title: z.string(),
  pollId: z.string().uuid(),
  votingOpensAt: z.coerce.date().nullable().optional(),
  votingClosesAt: z.coerce.date().nullable().optional(),
  poll: PollSchema,
  resultsSnapshot: PollResultsSchema.nullable().optional(),
});
export type ResolutionResults = z.infer<typeof ResolutionResultsSchema>;
