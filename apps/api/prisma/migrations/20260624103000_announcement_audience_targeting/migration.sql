-- Phase 1.5: announcement audience targeting (condo / blocks / units).
-- Idempotent for dev DBs that already received these objects via `prisma db push`.

DO $$ BEGIN
  CREATE TYPE "AnnouncementAudienceScope" AS ENUM ('CONDO', 'BLOCKS', 'UNITS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "audienceScope" "AnnouncementAudienceScope" NOT NULL DEFAULT 'CONDO';

CREATE TABLE IF NOT EXISTS "announcement_blocks" (
  "id" UUID NOT NULL,
  "announcementId" UUID NOT NULL,
  "blockId" UUID NOT NULL,
  CONSTRAINT "announcement_blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "announcement_units" (
  "id" UUID NOT NULL,
  "announcementId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  CONSTRAINT "announcement_units_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "announcement_blocks_blockId_idx"
  ON "announcement_blocks"("blockId");

CREATE UNIQUE INDEX IF NOT EXISTS "announcement_blocks_announcementId_blockId_key"
  ON "announcement_blocks"("announcementId", "blockId");

CREATE INDEX IF NOT EXISTS "announcement_units_unitId_idx"
  ON "announcement_units"("unitId");

CREATE UNIQUE INDEX IF NOT EXISTS "announcement_units_announcementId_unitId_key"
  ON "announcement_units"("announcementId", "unitId");

DO $$ BEGIN
  ALTER TABLE "announcement_blocks"
    ADD CONSTRAINT "announcement_blocks_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "announcements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "announcement_blocks"
    ADD CONSTRAINT "announcement_blocks_blockId_fkey"
    FOREIGN KEY ("blockId") REFERENCES "blocks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "announcement_units"
    ADD CONSTRAINT "announcement_units_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "announcements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "announcement_units"
    ADD CONSTRAINT "announcement_units_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
