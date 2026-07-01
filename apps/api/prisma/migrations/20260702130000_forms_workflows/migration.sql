-- Forms & workflows: condo management form templates and resident submissions.

CREATE TYPE "FormTemplateKind" AS ENUM (
  'MOVE_IN',
  'MOVE_OUT',
  'RENOVATION',
  'VEHICLE_STICKER',
  'CUSTOM'
);

CREATE TYPE "FormSubmissionStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "form_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "condoId" UUID NOT NULL,
  "kind" "FormTemplateKind" NOT NULL,
  "title" TEXT NOT NULL,
  "fields" JSONB NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "templateId" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "status" "FormSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "answers" JSONB NOT NULL DEFAULT '{}',
  "reviewedByUserId" UUID,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "form_templates_condoId_active_idx" ON "form_templates"("condoId", "active");
CREATE INDEX "form_submissions_condoId_status_idx" ON "form_submissions"("condoId", "status");
CREATE INDEX "form_submissions_userId_idx" ON "form_submissions"("userId");
CREATE INDEX "form_submissions_unitId_idx" ON "form_submissions"("unitId");
CREATE INDEX "form_submissions_templateId_idx" ON "form_submissions"("templateId");

ALTER TABLE "form_templates"
  ADD CONSTRAINT "form_templates_condoId_fkey"
  FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
  ADD CONSTRAINT "form_submissions_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
  ADD CONSTRAINT "form_submissions_condoId_fkey"
  FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
  ADD CONSTRAINT "form_submissions_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
  ADD CONSTRAINT "form_submissions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
  ADD CONSTRAINT "form_submissions_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extend notification kinds for form workflow events.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'FORM_SUBMITTED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'FORM_APPROVED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'FORM_REJECTED';
