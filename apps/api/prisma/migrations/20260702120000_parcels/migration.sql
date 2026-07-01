-- Parcels / deliveries (v0.4): guard logs incoming parcels, residents notified,
-- collection sign-off, overdue reminders.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ParcelStatus" AS ENUM ('RECEIVED', 'NOTIFIED', 'COLLECTED', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterEnum (NotificationKind)
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PARCEL_RECEIVED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PARCEL_OVERDUE';

-- CreateTable
CREATE TABLE IF NOT EXISTS "parcels" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "recipientName" TEXT NOT NULL,
  "carrier" TEXT,
  "trackingRef" TEXT,
  "status" "ParcelStatus" NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "collectedAt" TIMESTAMP(3),
  "receivedByGuardId" UUID NOT NULL,
  "collectedByUserId" UUID,
  "photoUrl" TEXT,
  "notes" TEXT,
  "lastOverdueNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "parcels_condoId_status_idx" ON "parcels"("condoId", "status");
CREATE INDEX IF NOT EXISTS "parcels_unitId_status_idx" ON "parcels"("unitId", "status");
CREATE INDEX IF NOT EXISTS "parcels_condoId_receivedAt_idx" ON "parcels"("condoId", "receivedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "parcels" ADD CONSTRAINT "parcels_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "parcels" ADD CONSTRAINT "parcels_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "parcels" ADD CONSTRAINT "parcels_receivedByGuardId_fkey"
    FOREIGN KEY ("receivedByGuardId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "parcels" ADD CONSTRAINT "parcels_collectedByUserId_fkey"
    FOREIGN KEY ("collectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
