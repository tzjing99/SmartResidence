-- Attachment transcode variants and announcement linkage.
-- Idempotent for dev DBs that already received these objects via `prisma db push`.

DO $$ BEGIN
  CREATE TYPE "TranscodeStatus" AS ENUM ('PENDING', 'READY', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "announcementId" UUID;

ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "fallbackKey" TEXT;

ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "fallbackMimeType" TEXT;

ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "fallbackThumbnailKey" TEXT;

ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "format" TEXT;

ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "transcodeStatus" "TranscodeStatus" NOT NULL DEFAULT 'PENDING';

CREATE INDEX IF NOT EXISTS "attachments_announcementId_idx"
  ON "attachments"("announcementId");

DO $$ BEGIN
  ALTER TABLE "attachments"
    ADD CONSTRAINT "attachments_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "announcements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
