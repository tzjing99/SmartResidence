-- Billing phase 2: append-only accounting ledger + per-unit cached account
-- (prepayment credit). Fund-tagged entries drive fund-balance & collections
-- reports. Idempotent for dev DBs that already received these via `prisma db push`.

DO $$ BEGIN
  CREATE TYPE "LedgerFund" AS ENUM ('MAINTENANCE', 'SINKING_FUND', 'DEPOSIT', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerEntryType" AS ENUM ('CHARGE', 'PAYMENT', 'DEPOSIT', 'REFUND', 'PREPAYMENT', 'PREPAYMENT_APPLIED', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -- Tables -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "unitId" UUID,
  "fund" "LedgerFund" NOT NULL DEFAULT 'GENERAL',
  "type" "LedgerEntryType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "memo" TEXT,
  "createdByUserId" UUID,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "unit_accounts" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "creditBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "unit_accounts_pkey" PRIMARY KEY ("id")
);

-- -- Indexes ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "ledger_entries_condoId_fund_occurredAt_idx" ON "ledger_entries"("condoId", "fund", "occurredAt");
CREATE INDEX IF NOT EXISTS "ledger_entries_condoId_type_occurredAt_idx" ON "ledger_entries"("condoId", "type", "occurredAt");
CREATE INDEX IF NOT EXISTS "ledger_entries_unitId_occurredAt_idx" ON "ledger_entries"("unitId", "occurredAt");

CREATE UNIQUE INDEX IF NOT EXISTS "unit_accounts_unitId_key" ON "unit_accounts"("unitId");
CREATE INDEX IF NOT EXISTS "unit_accounts_condoId_idx" ON "unit_accounts"("condoId");

-- -- Foreign keys -----------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "unit_accounts"
    ADD CONSTRAINT "unit_accounts_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "unit_accounts"
    ADD CONSTRAINT "unit_accounts_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
