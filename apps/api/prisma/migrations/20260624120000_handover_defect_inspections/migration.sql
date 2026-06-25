-- Handover defect inspections: unit types + room templates, per-condo defect
-- taxonomy (space type -> element -> issue), and defect reports (parent ticket
-- grouping many Defect line items).
-- Idempotent for dev DBs that already received these objects via `prisma db push`.

DO $$ BEGIN
  CREATE TYPE "DefectReportKind" AS ENUM ('HANDOVER', 'STANDARD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -- Tables -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "unit_types" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "unit_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "defect_space_types" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "defect_space_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "defect_elements" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "spaceTypeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "defect_elements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "defect_issues" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "elementId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "defect_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "unit_type_spaces" (
  "id" UUID NOT NULL,
  "unitTypeId" UUID NOT NULL,
  "spaceTypeId" UUID,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "unit_type_spaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "defect_reports" (
  "id" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "unitId" UUID,
  "raisedByUserId" UUID NOT NULL,
  "kind" "DefectReportKind" NOT NULL DEFAULT 'HANDOVER',
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "defect_reports_pkey" PRIMARY KEY ("id")
);

-- -- Altered columns -------------------------------------------------------

ALTER TABLE "units"
  ADD COLUMN IF NOT EXISTS "unitTypeId" UUID;

ALTER TABLE "defects"
  ADD COLUMN IF NOT EXISTS "reportId" UUID,
  ADD COLUMN IF NOT EXISTS "spaceTypeId" UUID,
  ADD COLUMN IF NOT EXISTS "elementId" UUID,
  ADD COLUMN IF NOT EXISTS "issueId" UUID,
  ADD COLUMN IF NOT EXISTS "spaceLabel" TEXT;

-- -- Indexes ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "unit_types_condoId_idx" ON "unit_types"("condoId");
CREATE INDEX IF NOT EXISTS "defect_space_types_condoId_idx" ON "defect_space_types"("condoId");
CREATE INDEX IF NOT EXISTS "defect_elements_condoId_idx" ON "defect_elements"("condoId");
CREATE INDEX IF NOT EXISTS "defect_elements_spaceTypeId_idx" ON "defect_elements"("spaceTypeId");
CREATE INDEX IF NOT EXISTS "defect_issues_condoId_idx" ON "defect_issues"("condoId");
CREATE INDEX IF NOT EXISTS "defect_issues_elementId_idx" ON "defect_issues"("elementId");
CREATE INDEX IF NOT EXISTS "unit_type_spaces_unitTypeId_idx" ON "unit_type_spaces"("unitTypeId");
CREATE INDEX IF NOT EXISTS "unit_type_spaces_spaceTypeId_idx" ON "unit_type_spaces"("spaceTypeId");
CREATE INDEX IF NOT EXISTS "defect_reports_condoId_createdAt_idx" ON "defect_reports"("condoId", "createdAt");
CREATE INDEX IF NOT EXISTS "defect_reports_unitId_idx" ON "defect_reports"("unitId");
CREATE INDEX IF NOT EXISTS "units_unitTypeId_idx" ON "units"("unitTypeId");
CREATE INDEX IF NOT EXISTS "defects_reportId_idx" ON "defects"("reportId");

-- -- Foreign keys -----------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "unit_types"
    ADD CONSTRAINT "unit_types_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defect_space_types"
    ADD CONSTRAINT "defect_space_types_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defect_elements"
    ADD CONSTRAINT "defect_elements_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defect_elements"
    ADD CONSTRAINT "defect_elements_spaceTypeId_fkey"
    FOREIGN KEY ("spaceTypeId") REFERENCES "defect_space_types"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defect_issues"
    ADD CONSTRAINT "defect_issues_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defect_issues"
    ADD CONSTRAINT "defect_issues_elementId_fkey"
    FOREIGN KEY ("elementId") REFERENCES "defect_elements"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "unit_type_spaces"
    ADD CONSTRAINT "unit_type_spaces_unitTypeId_fkey"
    FOREIGN KEY ("unitTypeId") REFERENCES "unit_types"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "unit_type_spaces"
    ADD CONSTRAINT "unit_type_spaces_spaceTypeId_fkey"
    FOREIGN KEY ("spaceTypeId") REFERENCES "defect_space_types"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defect_reports"
    ADD CONSTRAINT "defect_reports_condoId_fkey"
    FOREIGN KEY ("condoId") REFERENCES "condos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defect_reports"
    ADD CONSTRAINT "defect_reports_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defect_reports"
    ADD CONSTRAINT "defect_reports_raisedByUserId_fkey"
    FOREIGN KEY ("raisedByUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "units"
    ADD CONSTRAINT "units_unitTypeId_fkey"
    FOREIGN KEY ("unitTypeId") REFERENCES "unit_types"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defects"
    ADD CONSTRAINT "defects_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "defect_reports"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defects"
    ADD CONSTRAINT "defects_spaceTypeId_fkey"
    FOREIGN KEY ("spaceTypeId") REFERENCES "defect_space_types"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defects"
    ADD CONSTRAINT "defects_elementId_fkey"
    FOREIGN KEY ("elementId") REFERENCES "defect_elements"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "defects"
    ADD CONSTRAINT "defects_issueId_fkey"
    FOREIGN KEY ("issueId") REFERENCES "defect_issues"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
