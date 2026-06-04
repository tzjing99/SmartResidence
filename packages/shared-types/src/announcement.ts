import { z } from 'zod';

export const AnnouncementImportance = z.enum(['INFO', 'IMPORTANT', 'URGENT']);
export type AnnouncementImportance = z.infer<typeof AnnouncementImportance>;

export const AnnouncementSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  importance: AnnouncementImportance,
  publishedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  requiresAck: z.boolean(),
  pinned: z.boolean(),
});
export type Announcement = z.infer<typeof AnnouncementSchema>;
