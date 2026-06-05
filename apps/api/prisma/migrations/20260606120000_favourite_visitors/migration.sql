-- Favourite visitor templates for quick pre-registration

CREATE TABLE "favourite_visitors" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "vehiclePlate" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "favourite_visitors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "favourite_visitors_unitId_idx" ON "favourite_visitors"("unitId");
CREATE INDEX "favourite_visitors_userId_idx" ON "favourite_visitors"("userId");

ALTER TABLE "favourite_visitors" ADD CONSTRAINT "favourite_visitors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favourite_visitors" ADD CONSTRAINT "favourite_visitors_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
