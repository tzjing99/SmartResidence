-- Vendor bills / procurement (accounts payable MVP)

DO $$ BEGIN
  CREATE TYPE "VendorBillStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'VOID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "GlJournalSourceType" ADD VALUE IF NOT EXISTS 'VENDOR_BILL';
ALTER TYPE "GlJournalSourceType" ADD VALUE IF NOT EXISTS 'VENDOR_PAYMENT';

CREATE TABLE IF NOT EXISTS "vendors" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "contact" TEXT,
  "taxId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vendor_bills" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "vendorId" UUID NOT NULL,
  "billNumber" TEXT NOT NULL,
  "billDate" DATE NOT NULL,
  "dueDate" DATE NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "fund" "LedgerFund" NOT NULL,
  "status" "VendorBillStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT,
  "attachmentId" UUID,
  "approvedByUserId" UUID,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "glJournalEntryId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_bills_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vendors_condoId_active_idx" ON "vendors"("condoId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_bills_condoId_billNumber_key" ON "vendor_bills"("condoId", "billNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_bills_attachmentId_key" ON "vendor_bills"("attachmentId");
CREATE INDEX IF NOT EXISTS "vendor_bills_condoId_status_idx" ON "vendor_bills"("condoId", "status");
CREATE INDEX IF NOT EXISTS "vendor_bills_condoId_fund_idx" ON "vendor_bills"("condoId", "fund");
CREATE INDEX IF NOT EXISTS "vendor_bills_condoId_vendorId_idx" ON "vendor_bills"("condoId", "vendorId");

DO $$ BEGIN
  ALTER TABLE "vendors" ADD CONSTRAINT "vendors_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_attachmentId_fkey"
    FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_approvedByUserId_fkey"
    FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
