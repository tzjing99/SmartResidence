-- General ledger: chart of accounts, double-entry journals, bank reconciliation

DO $$ BEGIN
  CREATE TYPE "GlAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GlJournalSourceType" AS ENUM ('INVOICE', 'PAYMENT', 'MANUAL', 'REVERSAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "gl_accounts" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "GlAccountType" NOT NULL,
  "fund" "LedgerFund" NOT NULL DEFAULT 'GENERAL',
  "parentId" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gl_journal_entries" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "entryDate" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "sourceType" "GlJournalSourceType" NOT NULL,
  "sourceId" TEXT,
  "postedByUserId" UUID,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gl_journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "gl_journal_lines" (
  "id" UUID NOT NULL,
  "journalEntryId" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "fund" "LedgerFund" NOT NULL DEFAULT 'GENERAL',
  "memo" TEXT,
  CONSTRAINT "gl_journal_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_statement_imports" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "openingBalance" DECIMAL(14,2) NOT NULL,
  "closingBalance" DECIMAL(14,2) NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "importedByUserId" UUID,
  CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_statement_lines" (
  "id" UUID NOT NULL,
  "importId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "matchedJournalLineId" UUID,
  CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gl_accounts_condoId_code_key" ON "gl_accounts"("condoId", "code");
CREATE INDEX IF NOT EXISTS "gl_accounts_condoId_type_idx" ON "gl_accounts"("condoId", "type");
CREATE INDEX IF NOT EXISTS "gl_accounts_condoId_fund_idx" ON "gl_accounts"("condoId", "fund");

CREATE UNIQUE INDEX IF NOT EXISTS "gl_journal_entries_idempotencyKey_key" ON "gl_journal_entries"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "gl_journal_entries_condoId_entryDate_idx" ON "gl_journal_entries"("condoId", "entryDate");
CREATE INDEX IF NOT EXISTS "gl_journal_entries_condoId_sourceType_sourceId_idx" ON "gl_journal_entries"("condoId", "sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "gl_journal_lines_journalEntryId_idx" ON "gl_journal_lines"("journalEntryId");
CREATE INDEX IF NOT EXISTS "gl_journal_lines_accountId_idx" ON "gl_journal_lines"("accountId");
CREATE INDEX IF NOT EXISTS "gl_journal_lines_accountId_fund_idx" ON "gl_journal_lines"("accountId", "fund");

CREATE INDEX IF NOT EXISTS "bank_statement_imports_condoId_accountId_idx" ON "bank_statement_imports"("condoId", "accountId");
CREATE INDEX IF NOT EXISTS "bank_statement_imports_condoId_periodStart_periodEnd_idx" ON "bank_statement_imports"("condoId", "periodStart", "periodEnd");

CREATE INDEX IF NOT EXISTS "bank_statement_lines_importId_date_idx" ON "bank_statement_lines"("importId", "date");
CREATE INDEX IF NOT EXISTS "bank_statement_lines_matchedJournalLineId_idx" ON "bank_statement_lines"("matchedJournalLineId");

DO $$ BEGIN
  ALTER TABLE "gl_accounts"
    ADD CONSTRAINT "gl_accounts_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "gl_accounts"
    ADD CONSTRAINT "gl_accounts_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "gl_accounts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "gl_journal_entries"
    ADD CONSTRAINT "gl_journal_entries_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "gl_journal_entries"
    ADD CONSTRAINT "gl_journal_entries_postedByUserId_fkey"
    FOREIGN KEY ("postedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "gl_journal_lines"
    ADD CONSTRAINT "gl_journal_lines_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "gl_journal_entries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "gl_journal_lines"
    ADD CONSTRAINT "gl_journal_lines_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "gl_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_statement_imports"
    ADD CONSTRAINT "bank_statement_imports_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_statement_imports"
    ADD CONSTRAINT "bank_statement_imports_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "gl_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_statement_imports"
    ADD CONSTRAINT "bank_statement_imports_importedByUserId_fkey"
    FOREIGN KEY ("importedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_statement_lines"
    ADD CONSTRAINT "bank_statement_lines_importId_fkey"
    FOREIGN KEY ("importId") REFERENCES "bank_statement_imports"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_statement_lines"
    ADD CONSTRAINT "bank_statement_lines_matchedJournalLineId_fkey"
    FOREIGN KEY ("matchedJournalLineId") REFERENCES "gl_journal_lines"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
