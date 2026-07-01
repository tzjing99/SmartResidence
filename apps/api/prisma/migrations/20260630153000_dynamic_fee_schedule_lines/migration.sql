-- Dynamic monthly fee schedule lines for real-life billing items such as fire
-- insurance, quit rent, assessment, security, facility charges and special levy.

DO $$ BEGIN
  CREATE TYPE "FeeScheduleLineRateType" AS ENUM ('FLAT', 'PER_SQFT', 'PER_UNIT_TYPE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "fee_schedule_extra_lines" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'OTHER',
  "formula" TEXT,
  "rateType" "FeeScheduleLineRateType" NOT NULL DEFAULT 'FLAT',
  "amount" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "unitTypeAmounts" JSONB NOT NULL DEFAULT '{}',
  "recurring" BOOLEAN NOT NULL DEFAULT false,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_schedule_extra_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fee_schedule_extra_lines_condoId_enabled_idx"
  ON "fee_schedule_extra_lines"("condoId", "enabled");

CREATE INDEX IF NOT EXISTS "fee_schedule_extra_lines_condoId_code_idx"
  ON "fee_schedule_extra_lines"("condoId", "code");

CREATE INDEX IF NOT EXISTS "fee_schedule_extra_lines_condoId_effectiveFrom_effectiveTo_idx"
  ON "fee_schedule_extra_lines"("condoId", "effectiveFrom", "effectiveTo");

DO $$ BEGIN
  ALTER TABLE "fee_schedule_extra_lines"
    ADD CONSTRAINT "fee_schedule_extra_lines_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
