-- Facility / amenity booking with deposits (§4.6).
-- Adds bookable facilities plus resident bookings that reuse the existing
-- billing (invoice) and deposit systems via loose invoiceId/depositId links.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "facilities" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "capacity" INTEGER,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "bookingFee" DECIMAL(14,2),
  "depositAmount" DECIMAL(14,2),
  "openTime" TEXT NOT NULL DEFAULT '08:00',
  "closeTime" TEXT NOT NULL DEFAULT '22:00',
  "slotMinutes" INTEGER NOT NULL DEFAULT 60,
  "maxConcurrent" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "facilities_condoId_active_idx" ON "facilities"("condoId", "active");

-- CreateTable
CREATE TABLE IF NOT EXISTS "bookings" (
  "id" UUID NOT NULL,
  "facilityId" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "unitId" UUID,
  "userId" UUID NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "depositHeld" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "invoiceId" UUID,
  "depositId" UUID,
  "notes" TEXT,
  "reviewedByUserId" UUID,
  "reviewedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bookings_facilityId_startAt_idx" ON "bookings"("facilityId", "startAt");
CREATE INDEX IF NOT EXISTS "bookings_condoId_status_idx" ON "bookings"("condoId", "status");
CREATE INDEX IF NOT EXISTS "bookings_userId_idx" ON "bookings"("userId");
CREATE INDEX IF NOT EXISTS "bookings_unitId_idx" ON "bookings"("unitId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "facilities"
    ADD CONSTRAINT "facilities_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "facilities"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
