-- Money safety hardening: atomic billing number sequences and idempotency
-- constraints for payment/ledger flows. Kept idempotent for local databases
-- that have been iterated with hand-authored billing migrations.

CREATE TABLE IF NOT EXISTS "billing_number_sequences" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_number_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_number_sequences_condoId_kind_year_key"
  ON "billing_number_sequences"("condoId", "kind", "year");
CREATE INDEX IF NOT EXISTS "billing_number_sequences_condoId_idx"
  ON "billing_number_sequences"("condoId");

DO $$ BEGIN
  ALTER TABLE "billing_number_sequences"
    ADD CONSTRAINT "billing_number_sequences_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_idempotencyKey_key"
  ON "ledger_entries"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_providerRef_key"
  ON "payments"("provider", "providerRef")
  WHERE "providerRef" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_unitId_periodStart_active_key"
  ON "invoices"("unitId", "periodStart")
  WHERE "status" <> 'VOID';
