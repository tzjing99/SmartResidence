-- Attachment variants (additive; backfills defaults, no destructive changes).
-- Adds the AVIF + WebP variant model + async transcode lifecycle. Per-variant
-- byte sizes are stored in the existing `metadata` Json (variantBytes), so no
-- extra size columns are needed here.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TranscodeStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "format" TEXT,
  ADD COLUMN IF NOT EXISTS "fallbackKey" TEXT,
  ADD COLUMN IF NOT EXISTS "fallbackMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "fallbackThumbnailKey" TEXT,
  ADD COLUMN IF NOT EXISTS "transcodeStatus" "TranscodeStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill: existing attachments predate the transcode pipeline. They already
-- hold a usable derivative (webp for images, original otherwise), so mark them
-- READY/SKIPPED rather than re-transcoding, and derive `format` from mimeType.
UPDATE "attachments"
  SET "format" = CASE
        WHEN "mimeType" = 'image/webp' THEN 'webp'
        WHEN "mimeType" = 'image/avif' THEN 'avif'
        WHEN "mimeType" = 'image/jpeg' THEN 'jpeg'
        WHEN "mimeType" = 'image/png' THEN 'png'
        WHEN "mimeType" = 'image/gif' THEN 'gif'
        ELSE NULL
      END;

-- Re-encodable still images that already produced a webp derivative are READY;
-- everything else (gif passthrough, pdf, raw originals) is SKIPPED.
UPDATE "attachments"
  SET "transcodeStatus" = CASE
        WHEN "mimeType" = 'image/webp' THEN 'READY'::"TranscodeStatus"
        ELSE 'SKIPPED'::"TranscodeStatus"
      END;
