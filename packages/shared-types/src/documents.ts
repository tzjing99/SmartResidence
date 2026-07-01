import { z } from 'zod';

export const DocumentFolderAudience = z.enum(['ALL', 'OWNERS', 'MANAGEMENT']);
export type DocumentFolderAudience = z.infer<typeof DocumentFolderAudience>;

export const DOCUMENT_FOLDER_AUDIENCE_LABELS: Record<DocumentFolderAudience, string> = {
  ALL: 'All residents',
  OWNERS: 'Unit owners only',
  MANAGEMENT: 'Management only',
};

export const DocumentFolderSchema = z.object({
  id: z.string().uuid(),
  condoId: z.string().uuid(),
  name: z.string(),
  audience: DocumentFolderAudience,
  position: z.number().int(),
  active: z.boolean(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  _count: z.object({ documents: z.number().int() }).optional(),
});
export type DocumentFolder = z.infer<typeof DocumentFolderSchema>;

export const DocumentVersionSummarySchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number().int(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  publishedAt: z.coerce.date(),
  notes: z.string().nullable().optional(),
  uploadedBy: z.object({ id: z.string().uuid(), name: z.string() }).nullable().optional(),
});
export type DocumentVersionSummary = z.infer<typeof DocumentVersionSummarySchema>;

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  folderId: z.string().uuid(),
  condoId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  currentVersionId: z.string().uuid().nullable().optional(),
  active: z.boolean(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  folder: z
    .object({ id: z.string().uuid(), name: z.string(), audience: DocumentFolderAudience })
    .optional(),
  currentVersion: DocumentVersionSummarySchema.nullable().optional(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentVersionSchema = DocumentVersionSummarySchema.extend({
  documentId: z.string().uuid(),
  fileKey: z.string(),
  uploadedByUserId: z.string().uuid(),
  createdAt: z.coerce.date().optional(),
});
export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;

export const CreateDocumentFolderInputSchema = z.object({
  condoId: z.string().uuid(),
  name: z.string().min(1).max(120),
  audience: DocumentFolderAudience.optional(),
  position: z.number().int().optional(),
});
export type CreateDocumentFolderInput = z.infer<typeof CreateDocumentFolderInputSchema>;

export const UpdateDocumentFolderInputSchema = CreateDocumentFolderInputSchema.partial()
  .omit({ condoId: true })
  .extend({ active: z.boolean().optional() });
export type UpdateDocumentFolderInput = z.infer<typeof UpdateDocumentFolderInputSchema>;

export const CreateDocumentInputSchema = z.object({
  folderId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
});
export type CreateDocumentInput = z.infer<typeof CreateDocumentInputSchema>;

export const UpdateDocumentInputSchema = CreateDocumentInputSchema.partial().extend({
  folderId: z.string().uuid().optional(),
  active: z.boolean().optional(),
});
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentInputSchema>;

export const PublishDocumentVersionInputSchema = z.object({
  attachmentId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});
export type PublishDocumentVersionInput = z.infer<typeof PublishDocumentVersionInputSchema>;

export const DocumentDownloadUrlSchema = z.object({
  url: z.string().url(),
  expiresIn: z.number().int(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
});
export type DocumentDownloadUrl = z.infer<typeof DocumentDownloadUrlSchema>;
