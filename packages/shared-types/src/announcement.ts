import { z } from 'zod';

export const AnnouncementImportance = z.enum(['INFO', 'IMPORTANT', 'URGENT']);
export type AnnouncementImportance = z.infer<typeof AnnouncementImportance>;

export const AnnouncementCategory = z.enum(['NOTICE', 'DOCUMENT', 'MAINTENANCE']);
export type AnnouncementCategory = z.infer<typeof AnnouncementCategory>;

export const AnnouncementAudienceScope = z.enum(['CONDO', 'BLOCKS', 'UNITS']);
export type AnnouncementAudienceScope = z.infer<typeof AnnouncementAudienceScope>;

export const ANNOUNCEMENT_CATEGORY_OPTIONS: { value: AnnouncementCategory; label: string }[] = [
  { value: 'NOTICE', label: 'Notice' },
  { value: 'DOCUMENT', label: 'Document' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
];

export const ANNOUNCEMENT_IMPORTANCE_OPTIONS: { value: AnnouncementImportance; label: string }[] = [
  { value: 'INFO', label: 'Info' },
  { value: 'IMPORTANT', label: 'Important' },
  { value: 'URGENT', label: 'Urgent' },
];

export const AnnouncementAttachmentSchema = z.object({
  id: z.string().uuid(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  fileName: z.string().optional(),
});

export const AnnouncementSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  category: AnnouncementCategory,
  importance: AnnouncementImportance,
  audienceScope: AnnouncementAudienceScope,
  publishedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  requiresAck: z.boolean(),
  pinned: z.boolean(),
  readAt: z.coerce.date().nullable().optional(),
  deletedAt: z.coerce.date().nullable().optional(),
  attachments: z.array(AnnouncementAttachmentSchema).optional(),
});
export type Announcement = z.infer<typeof AnnouncementSchema>;

const announcementAudienceRefine = (
  data: {
    audienceScope?: AnnouncementAudienceScope | undefined;
    blockIds?: string[] | undefined;
    unitIds?: string[] | undefined;
  },
  ctx: z.RefinementCtx,
) => {
  const scope = data.audienceScope ?? 'CONDO';
  if (scope === 'BLOCKS' && (!data.blockIds || data.blockIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select at least one block when targeting by block',
      path: ['blockIds'],
    });
  }
  if (scope === 'UNITS' && (!data.unitIds || data.unitIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select at least one unit when targeting by unit',
      path: ['unitIds'],
    });
  }
};

export const CreateAnnouncementInputSchema = z
  .object({
    condoId: z.string().uuid(),
    title: z.string().min(4).max(200),
    body: z.string().min(1),
    category: AnnouncementCategory.optional(),
    importance: AnnouncementImportance.optional(),
    audienceScope: AnnouncementAudienceScope.optional(),
    blockIds: z.array(z.string().uuid()).optional(),
    unitIds: z.array(z.string().uuid()).optional(),
    publishedAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    requiresAck: z.boolean().optional(),
    pinned: z.boolean().optional(),
    attachmentIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine(announcementAudienceRefine);
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementInputSchema>;

/** Audience fields are locked once published — enforced in the API service (Stage C). */
export const UpdateAnnouncementInputSchema = z
  .object({
    title: z.string().min(4).max(200).optional(),
    body: z.string().min(1).optional(),
    category: AnnouncementCategory.optional(),
    importance: AnnouncementImportance.optional(),
    audienceScope: AnnouncementAudienceScope.optional(),
    blockIds: z.array(z.string().uuid()).optional(),
    unitIds: z.array(z.string().uuid()).optional(),
    publishedAt: z.coerce.date().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    requiresAck: z.boolean().optional(),
    pinned: z.boolean().optional(),
    attachmentIds: z.array(z.string().uuid()).optional(),
    republish: z.boolean().optional(),
  })
  .superRefine(announcementAudienceRefine);
export type UpdateAnnouncementInput = z.infer<typeof UpdateAnnouncementInputSchema>;

export const ListAnnouncementsParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  category: AnnouncementCategory.optional(),
});
export type ListAnnouncementsParams = z.infer<typeof ListAnnouncementsParamsSchema>;

/** Human-readable audience label for list/composer UI. */
export function audienceLabel(
  scope: AnnouncementAudienceScope,
  counts?: { blocks?: number; units?: number },
): string {
  switch (scope) {
    case 'CONDO':
      return 'All residents';
    case 'BLOCKS': {
      const n = counts?.blocks ?? 0;
      return n === 1 ? '1 block' : `${n} blocks`;
    }
    case 'UNITS': {
      const n = counts?.units ?? 0;
      return n === 1 ? '1 unit' : `${n} units`;
    }
    default:
      return scope;
  }
}
