-- Resident gateway-backed advance maintenance payments. These become unit
-- prepayment credit only after the gateway callback is verified.

CREATE TABLE IF NOT EXISTS "advance_payments" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "userId" UUID,
  "amount" DECIMAL(14,2) NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'MYR',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" "PaymentProvider" NOT NULL,
  "providerRef" TEXT,
  "paidAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "advance_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "advance_payments_condoId_status_idx"
  ON "advance_payments"("condoId", "status");
CREATE INDEX IF NOT EXISTS "advance_payments_unitId_idx"
  ON "advance_payments"("unitId");
CREATE INDEX IF NOT EXISTS "advance_payments_userId_idx"
  ON "advance_payments"("userId");
CREATE INDEX IF NOT EXISTS "advance_payments_providerRef_idx"
  ON "advance_payments"("providerRef");
CREATE UNIQUE INDEX IF NOT EXISTS "advance_payments_provider_providerRef_key"
  ON "advance_payments"("provider", "providerRef")
  WHERE "providerRef" IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE "advance_payments"
    ADD CONSTRAINT "advance_payments_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "advance_payments"
    ADD CONSTRAINT "advance_payments_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "advance_payments"
    ADD CONSTRAINT "advance_payments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
