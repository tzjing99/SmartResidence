import { z } from 'zod';

/**
 * Image mime types accepted by the upload pipeline.
 *
 * `image/heic` / `image/heif` are included because iOS captures and iCloud
 * library exports are HEIC by default. Mobile clients convert HEIC -> JPEG
 * before upload; web stores the original (iOS Safari already hands us JPEG
 * when picking from the album, desktop HEIC is stored as-is).
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
] as const;
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Maximum size for a single uploaded file (15 MB). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Maximum size for a PDF memo upload (25 MB). */
export const MAX_DOCUMENT_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf'] as const;
export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

/** How many attachments a single message / form may carry. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 6;

/** Max combined size of a single message's attachments (40 MB). */
export const MAX_TOTAL_UPLOAD_BYTES = 40 * 1024 * 1024;

/** Longest edge (px) the optimized full image is downscaled to server-side. */
export const IMAGE_MAX_DIMENSION = 1600;

/** Longest edge (px) of the generated thumbnail derivative. */
export const THUMBNAIL_MAX_DIMENSION = 400;

/** TTL (hours) after which an un-attached (PENDING) upload is swept. */
export const ORPHAN_ATTACHMENT_TTL_HOURS = 24;

/** Lifecycle status of an attachment. */
export type AttachmentStatus = 'PENDING' | 'COMMITTED';

/** HTML `accept` value for native file inputs (web). */
export const IMAGE_ACCEPT_ATTR = 'image/*,.heic,.heif';

/** HTML `accept` value for PDF memo uploads. */
export const DOCUMENT_ACCEPT_ATTR = 'application/pdf,.pdf';

export function isAllowedImageMime(mime: string | null | undefined): mime is AllowedImageMimeType {
  if (!mime) return false;
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime.toLowerCase());
}

export function isAllowedDocumentMime(
  mime: string | null | undefined,
): mime is AllowedDocumentMimeType {
  if (!mime) return false;
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mime.toLowerCase());
}

export function isPdfMime(mime: string | null | undefined): boolean {
  return isAllowedDocumentMime(mime);
}

export function isHeic(mime: string | null | undefined): boolean {
  if (!mime) return false;
  const m = mime.toLowerCase();
  return m === 'image/heic' || m === 'image/heif';
}

/** Strip path separators / odd characters so the storage key stays clean. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-');
  const trimmed = cleaned.replace(/^[-.]+/, '').slice(-120);
  return trimmed.length > 0 ? trimmed : 'upload';
}

/** Contract for the presign request body (`POST /api/attachments/presign`). */
export const PresignUploadSchema = z.object({
  contentType: z.string().min(1).max(120),
  fileName: z.string().min(1).max(200),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES).optional(),
});
export type PresignUploadInput = z.infer<typeof PresignUploadSchema>;

/** Response returned by the presign endpoint. */
export interface PresignUploadResponse {
  url: string;
  fields: Record<string, string>;
  bucket: string;
  key: string;
  expiresIn: number;
  attachmentId: string;
}

/**
 * Response from the multipart upload endpoint (`POST /api/uploads`). The
 * server has already optimized the image + generated a thumbnail; the raw
 * phone photo is never stored.
 */
export interface UploadResponse {
  attachmentId: string;
  key: string;
  thumbnailKey: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  status: AttachmentStatus;
}

/** A successfully uploaded attachment, as referenced by forms/messages. */
export interface UploadedAttachment {
  attachmentId: string;
  key: string;
  thumbnailKey?: string | null;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  /** Local preview URL/URI (object URL on web, file uri on mobile). */
  previewUrl?: string;
  fileName?: string;
}
