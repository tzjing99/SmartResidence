-- Generic automation run history for the admin pipeline/status view.

DO $$ BEGIN
  CREATE TYPE "AutomationJobKey" AS ENUM (
    'BILLING_GENERATION',
    'DUE_SWEEP',
    'PAYMENT_RECONCILIATION',
    'PAYMENT_REVIEW',
    'REMINDERS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AutomationRunStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'SUCCESS',
    'FAILED',
    'SKIPPED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "automation_runs" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "jobKey" "AutomationJobKey" NOT NULL,
  "stageName" TEXT NOT NULL,
  "status" "AutomationRunStatus" NOT NULL DEFAULT 'PENDING',
  "scheduledFor" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "summary" JSONB NOT NULL DEFAULT '{}',
  "errorMessage" TEXT,
  "triggeredByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "automation_runs_condoId_jobKey_createdAt_idx"
  ON "automation_runs"("condoId", "jobKey", "createdAt");
CREATE INDEX IF NOT EXISTS "automation_runs_condoId_status_scheduledFor_idx"
  ON "automation_runs"("condoId", "status", "scheduledFor");

DO $$ BEGIN
  ALTER TABLE "automation_runs"
    ADD CONSTRAINT "automation_runs_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
