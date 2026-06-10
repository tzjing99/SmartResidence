-- Announcements Phase 1 (additive; backfills defaults, no destructive changes).
-- Categories, audience targeting join tables, read-state, soft delete, PDF attachment link.

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('NOTICE', 'DOCUMENT', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AnnouncementAudienceScope" AS ENUM ('CONDO', 'BLOCKS', 'UNITS');

-- AlterTable
ALTER TABLE "announcements"
  ADD COLUMN "category" "AnnouncementCategory" NOT NULL DEFAULT 'NOTICE',
  ADD COLUMN "audienceScope" "AnnouncementAudienceScope" NOT NULL DEFAULT 'CONDO',
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "attachments"
  ADD COLUMN "announcementId" UUID;

-- CreateTable
CREATE TABLE "announcement_blocks" (
    "id" UUID NOT NULL,
    "announcementId" UUID NOT NULL,
    "blockId" UUID NOT NULL,

    CONSTRAINT "announcement_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_units" (
    "id" UUID NOT NULL,
    "announcementId" UUID NOT NULL,
    "unitId" UUID NOT NULL,

    CONSTRAINT "announcement_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" UUID NOT NULL,
    "announcementId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "announcements_condoId_category_publishedAt_idx" ON "announcements"("condoId", "category", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "announcement_blocks_announcementId_blockId_key" ON "announcement_blocks"("announcementId", "blockId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "announcement_blocks_blockId_idx" ON "announcement_blocks"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "announcement_units_announcementId_unitId_key" ON "announcement_units"("announcementId", "unitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "announcement_units_unitId_idx" ON "announcement_units"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "announcement_reads_announcementId_userId_key" ON "announcement_reads"("announcementId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "announcement_reads_userId_idx" ON "announcement_reads"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attachments_announcementId_idx" ON "attachments"("announcementId");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_blocks" ADD CONSTRAINT "announcement_blocks_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_blocks" ADD CONSTRAINT "announcement_blocks_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_units" ADD CONSTRAINT "announcement_units_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_units" ADD CONSTRAINT "announcement_units_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
