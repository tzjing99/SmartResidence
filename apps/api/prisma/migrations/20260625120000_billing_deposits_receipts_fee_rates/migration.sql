-- Billing phase 1: per-unit-type fee rates, refundable deposits, and official
-- receipts (auto-issued on deposit recording / payment success).
-- Idempotent for dev DBs that already received these objects via `prisma db push`.

DO $$ BEGIN
  CREATE TYPE "FeeRateType" AS ENUM ('PER_SQFT', 'FLAT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DepositType" AS ENUM ('RENOVATION', 'RENOVATION_DELIVERY', 'ACCESS_CARD', 'KEY', 'MOVE_IN_OUT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DepositStatus" AS ENUM ('HELD', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FORFEITED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReceiptKind" AS ENUM ('PAYMENT', 'DEPOSIT', 'REFUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -- Tables -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "unit_type_fee_rates" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "unitTypeId" UUID NOT NULL,
  "maintenanceRateType" "FeeRateType" NOT NULL DEFAULT 'PER_SQFT',
  "maintenanceAmount" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "sinkingFundRateType" "FeeRateType" NOT NULL DEFAULT 'PER_SQFT',
  "sinkingFundAmount" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "currencyCode" TEXT NOT NULL DEFAULT 'MYR',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "unit_type_fee_rates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "deposits" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "userId" UUID,
  "type" "DepositType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'MYR',
  "status" "DepositStatus" NOT NULL DEFAULT 'HELD',
  "method" TEXT,
  "reference" TEXT,
  "refundedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "forfeitedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "refundedAt" TIMESTAMP(3),
  "notes" TEXT,
  "recordedByUserId" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "receipts" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "kind" "ReceiptKind" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'MYR',
  "issuedToUserId" UUID,
  "unitId" UUID,
  "paymentId" UUID,
  "depositId" UUID,
  "description" TEXT,
  "templateSnapshot" JSONB NOT NULL DEFAULT '{}',
  "pdfKey" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- -- Indexes ----------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "unit_type_fee_rates_unitTypeId_key" ON "unit_type_fee_rates"("unitTypeId");
CREATE INDEX IF NOT EXISTS "unit_type_fee_rates_condoId_idx" ON "unit_type_fee_rates"("condoId");

CREATE INDEX IF NOT EXISTS "deposits_condoId_status_idx" ON "deposits"("condoId", "status");
CREATE INDEX IF NOT EXISTS "deposits_unitId_idx" ON "deposits"("unitId");
CREATE INDEX IF NOT EXISTS "deposits_userId_idx" ON "deposits"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "receipts_paymentId_key" ON "receipts"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "receipts_depositId_key" ON "receipts"("depositId");
CREATE UNIQUE INDEX IF NOT EXISTS "receipts_condoId_number_key" ON "receipts"("condoId", "number");
CREATE INDEX IF NOT EXISTS "receipts_condoId_kind_idx" ON "receipts"("condoId", "kind");
CREATE INDEX IF NOT EXISTS "receipts_unitId_idx" ON "receipts"("unitId");
CREATE INDEX IF NOT EXISTS "receipts_issuedToUserId_idx" ON "receipts"("issuedToUserId");

-- -- Foreign keys -----------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "unit_type_fee_rates"
    ADD CONSTRAINT "unit_type_fee_rates_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "unit_type_fee_rates"
    ADD CONSTRAINT "unit_type_fee_rates_unitTypeId_fkey"
    FOREIGN KEY ("unitTypeId") REFERENCES "unit_types"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "deposits"
    ADD CONSTRAINT "deposits_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "deposits"
    ADD CONSTRAINT "deposits_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "deposits"
    ADD CONSTRAINT "deposits_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "receipts"
    ADD CONSTRAINT "receipts_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "receipts"
    ADD CONSTRAINT "receipts_issuedToUserId_fkey"
    FOREIGN KEY ("issuedToUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "receipts"
    ADD CONSTRAINT "receipts_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "receipts"
    ADD CONSTRAINT "receipts_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "receipts"
    ADD CONSTRAINT "receipts_depositId_fkey"
    FOREIGN KEY ("depositId") REFERENCES "deposits"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
