-- Visitor F1: two-path flow (pre-reg fast lane + walk-in unit/office)

CREATE TYPE "VisitorVisitType" AS ENUM ('PRE_REG', 'WALKIN_UNIT', 'WALKIN_OFFICE');

ALTER TYPE "VisitorStatus" RENAME VALUE 'PENDING' TO 'PENDING_OWNER_APPROVAL';

ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "visitType" "VisitorVisitType" NOT NULL DEFAULT 'PRE_REG';
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "accessCode" TEXT;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "qrPayload" TEXT;
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "visitors" ADD COLUMN IF NOT EXISTS "approvalDeadline" TIMESTAMP(3);

UPDATE "visitors"
SET "accessCode" = upper(substr(md5("id"::text || coalesce("qrCode", '')), 1, 6))
WHERE "accessCode" IS NULL;

UPDATE "visitors"
SET "qrPayload" = "condoId"::text || ':' || "id"::text || ':' || "accessCode"
WHERE "qrPayload" IS NULL AND "accessCode" IS NOT NULL;

UPDATE "visitors"
SET "expiresAt" = "expectedAt" + interval '4 hours'
WHERE "expiresAt" IS NULL;

ALTER TABLE "visitors" ALTER COLUMN "unitId" DROP NOT NULL;
ALTER TABLE "visitors" ALTER COLUMN "hostUserId" DROP NOT NULL;
ALTER TABLE "visitors" ALTER COLUMN "qrCode" DROP NOT NULL;

DROP INDEX IF EXISTS "visitors_accessCode_key";

CREATE UNIQUE INDEX IF NOT EXISTS "visitors_qrPayload_key" ON "visitors"("qrPayload");
CREATE UNIQUE INDEX IF NOT EXISTS "visitors_condoId_accessCode_key" ON "visitors"("condoId", "accessCode");
CREATE INDEX IF NOT EXISTS "visitors_expiresAt_idx" ON "visitors"("expiresAt");
CREATE INDEX IF NOT EXISTS "visitors_approvalDeadline_idx" ON "visitors"("approvalDeadline");
