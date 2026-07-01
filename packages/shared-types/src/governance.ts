import { z } from 'zod';
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

export const MeetingProxySchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  unitId: z.string().uuid(),
  unitIdentifier: z.string().optional(),
  proxyHolderName: z.string(),
  proxyHolderContact: z.string().optional(),
  submittedAt: z.coerce.date(),
});
export type MeetingProxy = z.infer<typeof MeetingProxySchema>;

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
});
export type MeetingResolution = z.infer<typeof MeetingResolutionSchema>;

export const GeneralMeetingSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  kind: GeneralMeetingKind,
  title: z.string(),
  scheduledAt: z.coerce.date(),
  noticeBody: z.string().optional(),
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
  status: GeneralMeetingStatus.optional(),
});
export type UpdateGeneralMeetingInput = z.infer<typeof UpdateGeneralMeetingInputSchema>;

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
});
export type ResolutionResults = z.infer<typeof ResolutionResultsSchema>;
