-- Lost & found board (non-commercial): residents post lost/found items for the condo.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LostFoundKind" AS ENUM ('LOST', 'FOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LostFoundStatus" AS ENUM ('OPEN', 'RESOLVED', 'REMOVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterEnum (NotificationKind)
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'LOST_FOUND_POST';

-- CreateTable
CREATE TABLE IF NOT EXISTS "lost_found_posts" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "kind" "LostFoundKind" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "locationNote" TEXT,
  "contactMethod" TEXT NOT NULL,
  "status" "LostFoundStatus" NOT NULL DEFAULT 'OPEN',
  "photoAttachmentId" UUID,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lost_found_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lost_found_posts_photoAttachmentId_key" ON "lost_found_posts"("photoAttachmentId");
CREATE INDEX IF NOT EXISTS "lost_found_posts_condoId_status_idx" ON "lost_found_posts"("condoId", "status");
CREATE INDEX IF NOT EXISTS "lost_found_posts_condoId_kind_status_idx" ON "lost_found_posts"("condoId", "kind", "status");
CREATE INDEX IF NOT EXISTS "lost_found_posts_userId_idx" ON "lost_found_posts"("userId");
CREATE INDEX IF NOT EXISTS "lost_found_posts_unitId_idx" ON "lost_found_posts"("unitId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "lost_found_posts" ADD CONSTRAINT "lost_found_posts_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "lost_found_posts" ADD CONSTRAINT "lost_found_posts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "lost_found_posts" ADD CONSTRAINT "lost_found_posts_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "lost_found_posts" ADD CONSTRAINT "lost_found_posts_photoAttachmentId_fkey"
    FOREIGN KEY ("photoAttachmentId") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
