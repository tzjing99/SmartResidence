-- AlterTable
ALTER TABLE "visitors" ADD COLUMN "vehiclePlatePhotoUrl" TEXT,
ADD COLUMN "plateMismatchFlagged" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "unit_visitor_policies" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "overnightSuspendedUntil" TIMESTAMP(3),
    "suspendReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_visitor_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_visitor_policies_unitId_userId_key" ON "unit_visitor_policies"("unitId", "userId");
CREATE INDEX "unit_visitor_policies_condoId_idx" ON "unit_visitor_policies"("condoId");

-- AddForeignKey
ALTER TABLE "unit_visitor_policies" ADD CONSTRAINT "unit_visitor_policies_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unit_visitor_policies" ADD CONSTRAINT "unit_visitor_policies_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unit_visitor_policies" ADD CONSTRAINT "unit_visitor_policies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
