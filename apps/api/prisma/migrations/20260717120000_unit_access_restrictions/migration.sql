-- CreateEnum
CREATE TYPE "AccessRestrictionSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "unit_access_restrictions" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "source" "AccessRestrictionSource" NOT NULL DEFAULT 'AUTO',
    "manualExempt" BOOLEAN NOT NULL DEFAULT false,
    "zones" JSONB NOT NULL DEFAULT '["CAR_PARK","AMENITIES"]',
    "reason" TEXT,
    "outstandingAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "oldestDueDate" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_access_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_access_restrictions_unitId_key" ON "unit_access_restrictions"("unitId");

-- CreateIndex
CREATE INDEX "unit_access_restrictions_condoId_active_idx" ON "unit_access_restrictions"("condoId", "active");

-- AddForeignKey
ALTER TABLE "unit_access_restrictions" ADD CONSTRAINT "unit_access_restrictions_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_access_restrictions" ADD CONSTRAINT "unit_access_restrictions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_access_restrictions" ADD CONSTRAINT "unit_access_restrictions_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
