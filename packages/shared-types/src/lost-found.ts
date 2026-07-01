import { z } from 'zod';

export const LostFoundKind = z.enum(['LOST', 'FOUND']);
export type LostFoundKind = z.infer<typeof LostFoundKind>;

export const LOST_FOUND_KIND_LABELS: Record<LostFoundKind, string> = {
  LOST: 'Lost item',
  FOUND: 'Found item',
};

export const LostFoundStatus = z.enum(['OPEN', 'RESOLVED', 'REMOVED']);
export type LostFoundStatus = z.infer<typeof LostFoundStatus>;

export const LOST_FOUND_STATUS_LABELS: Record<LostFoundStatus, string> = {
  OPEN: 'Open',
  RESOLVED: 'Resolved',
  REMOVED: 'Removed',
};

export const LostFoundPostSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  userId: z.string().uuid(),
  unitId: z.string().uuid(),
  kind: LostFoundKind,
  title: z.string(),
  description: z.string(),
  locationNote: z.string().nullable().optional(),
  contactMethod: z.string(),
  status: LostFoundStatus,
  photoAttachmentId: z.string().uuid().nullable().optional(),
  resolvedAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  user: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  unit: z
    .object({
      id: z.string().uuid(),
      identifier: z.string(),
      block: z.object({ name: z.string() }).nullable().optional(),
    })
    .nullable()
    .optional(),
  photoAttachment: z
    .object({
      id: z.string().uuid(),
      key: z.string(),
      mimeType: z.string(),
      thumbnailKey: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type LostFoundPost = z.infer<typeof LostFoundPostSchema>;

export const CreateLostFoundPostInputSchema = z.object({
  condoId: z.string().uuid(),
  unitId: z.string().uuid(),
  kind: LostFoundKind,
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  locationNote: z.string().max(200).optional(),
  contactMethod: z.string().min(3).max(200),
  photoAttachmentId: z.string().uuid().optional(),
});
export type CreateLostFoundPostInput = z.infer<typeof CreateLostFoundPostInputSchema>;

export const ListLostFoundPostsParamsSchema = z.object({
  kind: LostFoundKind.optional(),
  status: LostFoundStatus.optional(),
  openOnly: z.boolean().optional(),
  manage: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});
export type ListLostFoundPostsParams = z.infer<typeof ListLostFoundPostsParamsSchema>;
