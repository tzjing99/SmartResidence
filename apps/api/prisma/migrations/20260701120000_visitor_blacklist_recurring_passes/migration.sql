-- Visitor blacklist and recurring passes

CREATE TABLE "visitor_blacklist" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "vehiclePlate" TEXT,
    "idNumber" TEXT,
    "reason" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_blacklist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recurring_passes" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "hostUserId" UUID NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "vehiclePlate" TEXT,
    "schedule" JSONB NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "accessCode" TEXT,
    "qrPayload" TEXT,
    "qrCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_passes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recurring_passes_qrPayload_key" ON "recurring_passes"("qrPayload");
CREATE UNIQUE INDEX "recurring_passes_condoId_accessCode_key" ON "recurring_passes"("condoId", "accessCode");
CREATE INDEX "visitor_blacklist_condoId_idx" ON "visitor_blacklist"("condoId");
CREATE INDEX "visitor_blacklist_condoId_vehiclePlate_idx" ON "visitor_blacklist"("condoId", "vehiclePlate");
CREATE INDEX "visitor_blacklist_condoId_phone_idx" ON "visitor_blacklist"("condoId", "phone");
CREATE INDEX "recurring_passes_condoId_idx" ON "recurring_passes"("condoId");
CREATE INDEX "recurring_passes_unitId_idx" ON "recurring_passes"("unitId");
CREATE INDEX "recurring_passes_hostUserId_idx" ON "recurring_passes"("hostUserId");
CREATE INDEX "recurring_passes_condoId_vehiclePlate_idx" ON "recurring_passes"("condoId", "vehiclePlate");
CREATE INDEX "recurring_passes_condoId_guestPhone_idx" ON "recurring_passes"("condoId", "guestPhone");

ALTER TABLE "visitor_blacklist" ADD CONSTRAINT "visitor_blacklist_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visitor_blacklist" ADD CONSTRAINT "visitor_blacklist_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_passes" ADD CONSTRAINT "recurring_passes_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_passes" ADD CONSTRAINT "recurring_passes_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_passes" ADD CONSTRAINT "recurring_passes_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
