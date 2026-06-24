import { z } from 'zod';

export const AnnouncementImportance = z.enum(['INFO', 'IMPORTANT', 'URGENT']);
export type AnnouncementImportance = z.infer<typeof AnnouncementImportance>;

export const AnnouncementCategory = z.enum(['NOTICE', 'DOCUMENT', 'MAINTENANCE']);
export type AnnouncementCategory = z.infer<typeof AnnouncementCategory>;

export const AnnouncementAudienceScope = z.enum(['CONDO', 'BLOCKS', 'UNITS']);
export type AnnouncementAudienceScope = z.infer<typeof AnnouncementAudienceScope>;

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  NOTICE: 'General notice',
  DOCUMENT: 'Official memo',
  MAINTENANCE: 'Maintenance',
};

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudienceScope, string> = {
  CONDO: 'Whole condo',
  BLOCKS: 'Specific blocks',
  UNITS: 'Specific units',
};

export const AnnouncementStatus = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED']);
export type AnnouncementStatus = z.infer<typeof AnnouncementStatus>;

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Live',
  EXPIRED: 'Expired',
};

/** Derive the lifecycle status from publish/expiry dates (shared by API + web). */
export function announcementStatus(
  a: { publishedAt?: Date | string | null; expiresAt?: Date | string | null },
  now: Date = new Date(),
): AnnouncementStatus {
  if (!a.publishedAt) return 'DRAFT';
  const published = new Date(a.publishedAt);
  if (published.getTime() > now.getTime()) return 'SCHEDULED';
  if (a.expiresAt && new Date(a.expiresAt).getTime() <= now.getTime()) return 'EXPIRED';
  return 'PUBLISHED';
}

export const AnnouncementAttachmentSchema = z.object({
  id: z.string().uuid(),
  mimeType: z.string(),
  size: z.number().int(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  fileName: z.string().nullable().optional(),
});

export type AnnouncementAttachment = z.infer<typeof AnnouncementAttachmentSchema>;

export const AnnouncementAudienceBlockSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export const AnnouncementAudienceUnitSchema = z.object({
  id: z.string().uuid(),
  identifier: z.string(),
});

/** Admin read/ack engagement scoped to audience recipients. */
export const AnnouncementReadStatsSchema = z.object({
  recipientCount: z.number().int(),
  readCount: z.number().int(),
  ackCount: z.number().int(),
  readPercent: z.number().int(),
  ackPercent: z.number().int(),
});
export type AnnouncementReadStats = z.infer<typeof AnnouncementReadStatsSchema>;

export const AnnouncementSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  importance: AnnouncementImportance,
  category: AnnouncementCategory,
  audienceScope: AnnouncementAudienceScope.optional(),
  audienceSummary: z.string().optional(),
  audienceBlocks: z.array(AnnouncementAudienceBlockSchema).optional(),
  audienceUnits: z.array(AnnouncementAudienceUnitSchema).optional(),
  status: AnnouncementStatus.optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  requiresAck: z.boolean(),
  pinned: z.boolean(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  author: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  attachments: z.array(AnnouncementAttachmentSchema).optional(),
  ackCount: z.number().int().optional(),
  readCount: z.number().int().optional(),
  /** Present on manage list when includeStats=true */
  readStats: AnnouncementReadStatsSchema.pick({
    recipientCount: true,
    readCount: true,
    readPercent: true,
  }).optional(),
  readByMe: z.boolean().optional(),
  ackedByMe: z.boolean().optional(),
});
export type Announcement = z.infer<typeof AnnouncementSchema>;

export const CreateAnnouncementInputSchema = z.object({
  condoId: z.string().uuid(),
  title: z.string().min(4).max(200),
  body: z.string().min(1),
  importance: AnnouncementImportance.optional(),
  category: AnnouncementCategory.optional(),
  audienceScope: AnnouncementAudienceScope.optional(),
  blockIds: z.array(z.string().uuid()).optional(),
  unitIds: z.array(z.string().uuid()).optional(),
  publishedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  requiresAck: z.boolean().optional(),
  pinned: z.boolean().optional(),
  attachmentIds: z.array(z.string().uuid()).max(6).optional(),
});
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementInputSchema>;

export const UpdateAnnouncementInputSchema = CreateAnnouncementInputSchema.partial().extend({
  publishedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});
export type UpdateAnnouncementInput = z.infer<typeof UpdateAnnouncementInputSchema>;

/** Max attachments per announcement (typically 1 PDF memo + a few photos). */
export const MAX_ANNOUNCEMENT_ATTACHMENTS = 6;

/** Plain-text excerpt for list previews (strip markdown noise). */
export function announcementExcerpt(body: string, maxLen = 120): string {
  const plain = body
    .replace(/[#*_`[\]()>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1)}…`;
}
