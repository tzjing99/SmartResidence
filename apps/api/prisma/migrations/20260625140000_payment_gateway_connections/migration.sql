-- Billing phase 3: per-condo payment gateway connections with envelope-encrypted
-- secrets (AES-256-GCM). Idempotent for dev DBs that received these via push.

DO $$ BEGIN
  CREATE TYPE "GatewayMode" AS ENUM ('TEST', 'LIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payment_gateway_connections" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "mode" "GatewayMode" NOT NULL DEFAULT 'TEST',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "displayName" TEXT,
  "publicConfig" JSONB NOT NULL DEFAULT '{}',
  "encryptedSecret" BYTEA,
  "secretIv" BYTEA,
  "secretAuthTag" BYTEA,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_gateway_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_gateway_connections_condoId_provider_mode_key"
  ON "payment_gateway_connections"("condoId", "provider", "mode");
CREATE INDEX IF NOT EXISTS "payment_gateway_connections_condoId_idx"
  ON "payment_gateway_connections"("condoId");

DO $$ BEGIN
  ALTER TABLE "payment_gateway_connections"
    ADD CONSTRAINT "payment_gateway_connections_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
