-- Guard safety: panic / SOS alerts + patrol checkpoint tours.
-- Adds SOS alerts (raised by residents, dispatched to management + guards) and
-- QR-checkpoint patrol tours (management CRUDs checkpoints; guards scan them).

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SosKind" AS ENUM ('MEDICAL', 'SECURITY', 'FIRE', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SosStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PatrolScanSource" AS ENUM ('ONLINE', 'OFFLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable: sos_alerts
CREATE TABLE IF NOT EXISTS "sos_alerts" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "raisedByUserId" UUID NOT NULL,
  "unitId" UUID,
  "kind" "SosKind" NOT NULL DEFAULT 'GENERAL',
  "status" "SosStatus" NOT NULL DEFAULT 'ACTIVE',
  "locationNote" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "acknowledgedByUserId" UUID,
  "acknowledgedAt" TIMESTAMP(3),
  "resolvedByUserId" UUID,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sos_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sos_alerts_condoId_status_idx" ON "sos_alerts"("condoId", "status");
CREATE INDEX IF NOT EXISTS "sos_alerts_condoId_createdAt_idx" ON "sos_alerts"("condoId", "createdAt");
CREATE INDEX IF NOT EXISTS "sos_alerts_raisedByUserId_idx" ON "sos_alerts"("raisedByUserId");

-- CreateTable: patrol_checkpoints
CREATE TABLE IF NOT EXISTS "patrol_checkpoints" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "expectedIntervalMinutes" INTEGER,
  "lastOverdueNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "patrol_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patrol_checkpoints_code_key" ON "patrol_checkpoints"("code");
CREATE INDEX IF NOT EXISTS "patrol_checkpoints_condoId_active_idx" ON "patrol_checkpoints"("condoId", "active");

-- CreateTable: patrol_scans
CREATE TABLE IF NOT EXISTS "patrol_scans" (
  "id" UUID NOT NULL,
  "checkpointId" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "guardUserId" UUID NOT NULL,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "note" TEXT,
  "source" "PatrolScanSource" NOT NULL DEFAULT 'ONLINE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patrol_scans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patrol_scans_condoId_scannedAt_idx" ON "patrol_scans"("condoId", "scannedAt");
CREATE INDEX IF NOT EXISTS "patrol_scans_checkpointId_scannedAt_idx" ON "patrol_scans"("checkpointId", "scannedAt");
CREATE INDEX IF NOT EXISTS "patrol_scans_guardUserId_scannedAt_idx" ON "patrol_scans"("guardUserId", "scannedAt");

-- AddForeignKey: sos_alerts
DO $$ BEGIN
  ALTER TABLE "sos_alerts"
    ADD CONSTRAINT "sos_alerts_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sos_alerts"
    ADD CONSTRAINT "sos_alerts_raisedByUserId_fkey"
    FOREIGN KEY ("raisedByUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sos_alerts"
    ADD CONSTRAINT "sos_alerts_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sos_alerts"
    ADD CONSTRAINT "sos_alerts_acknowledgedByUserId_fkey"
    FOREIGN KEY ("acknowledgedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sos_alerts"
    ADD CONSTRAINT "sos_alerts_resolvedByUserId_fkey"
    FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: patrol_checkpoints
DO $$ BEGIN
  ALTER TABLE "patrol_checkpoints"
    ADD CONSTRAINT "patrol_checkpoints_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: patrol_scans
DO $$ BEGIN
  ALTER TABLE "patrol_scans"
    ADD CONSTRAINT "patrol_scans_checkpointId_fkey"
    FOREIGN KEY ("checkpointId") REFERENCES "patrol_checkpoints"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "patrol_scans"
    ADD CONSTRAINT "patrol_scans_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "patrol_scans"
    ADD CONSTRAINT "patrol_scans_guardUserId_fkey"
    FOREIGN KEY ("guardUserId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
