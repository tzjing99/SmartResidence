-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'COMMITTED');

-- AlterTable
ALTER TABLE "attachments"
  ADD COLUMN "thumbnailKey" TEXT,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill: existing attachments predate the lifecycle and are already in use.
UPDATE "attachments" SET "status" = 'COMMITTED';

-- CreateIndex
CREATE INDEX "attachments_status_createdAt_idx" ON "attachments"("status", "createdAt");
