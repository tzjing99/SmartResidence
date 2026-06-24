-- Announcements phase extras: category, soft-delete, read tracking.
-- Idempotent for dev DBs that already received these objects via `prisma db push`.

DO $$ BEGIN
  CREATE TYPE "AnnouncementCategory" AS ENUM ('NOTICE', 'DOCUMENT', 'MAINTENANCE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "category" "AnnouncementCategory" NOT NULL DEFAULT 'NOTICE';

ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "announcement_reads" (
  "id" UUID NOT NULL,
  "announcementId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "announcement_reads_userId_idx"
  ON "announcement_reads"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "announcement_reads_announcementId_userId_key"
  ON "announcement_reads"("announcementId", "userId");

CREATE INDEX IF NOT EXISTS "announcements_condoId_category_publishedAt_idx"
  ON "announcements"("condoId", "category", "publishedAt");

DO $$ BEGIN
  ALTER TABLE "announcement_reads"
    ADD CONSTRAINT "announcement_reads_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "announcements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "announcement_reads"
    ADD CONSTRAINT "announcement_reads_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
