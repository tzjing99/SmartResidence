-- Malaysian LHDN MyInvois e-invoicing. Each Invoice may have one EInvoice row
-- tracking the generated UBL/JSON payload snapshot plus the identifiers and
-- validation state returned by LHDN (or the sandbox adapter).

DO $$ BEGIN
  CREATE TYPE "EInvoiceStatus" AS ENUM (
    'NOT_SUBMITTED',
    'PENDING',
    'VALID',
    'INVALID',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "einvoices" (
  "id" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "status" "EInvoiceStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
  "lhdnUuid" TEXT,
  "lhdnLongId" TEXT,
  "submissionUid" TEXT,
  "qrPayload" TEXT,
  "validationUrl" TEXT,
  "documentJson" JSONB NOT NULL DEFAULT '{}',
  "validatedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "einvoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "einvoices_invoiceId_key" ON "einvoices"("invoiceId");
CREATE INDEX IF NOT EXISTS "einvoices_condoId_status_idx" ON "einvoices"("condoId", "status");
CREATE INDEX IF NOT EXISTS "einvoices_lhdnUuid_idx" ON "einvoices"("lhdnUuid");

DO $$ BEGIN
  ALTER TABLE "einvoices"
    ADD CONSTRAINT "einvoices_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "einvoices"
    ADD CONSTRAINT "einvoices_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
