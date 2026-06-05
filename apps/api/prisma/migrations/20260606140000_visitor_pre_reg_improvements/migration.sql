-- CreateEnum
CREATE TYPE "VisitorEntryMode" AS ENUM ('WALK_IN', 'DRIVE_IN');
CREATE TYPE "VisitorPurpose" AS ENUM ('VISITOR', 'CONTRACTOR', 'GOVERNMENT_UTILITIES', 'DELIVERY', 'MAINTENANCE', 'OTHER');

-- AlterEnum
ALTER TYPE "VisitorStatus" ADD VALUE 'PENDING_MANAGEMENT_APPROVAL';

-- AlterTable
ALTER TABLE "visitors" ADD COLUMN     "phoneCountryCode" TEXT NOT NULL DEFAULT '+60',
ADD COLUMN     "entryMode" "VisitorEntryMode" NOT NULL DEFAULT 'WALK_IN',
ADD COLUMN     "overnight" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "urgentOvernight" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "urgentReason" TEXT,
ADD COLUMN     "pendingManagementReview" BOOLEAN NOT NULL DEFAULT false;

-- Migrate free-text purpose to enum (best-effort mapping)
ALTER TABLE "visitors" ALTER COLUMN "purpose" DROP DEFAULT;
ALTER TABLE "visitors" ALTER COLUMN "purpose" TYPE "VisitorPurpose" USING (
  CASE
    WHEN "purpose" IS NULL OR trim("purpose") = '' THEN 'VISITOR'::"VisitorPurpose"
    WHEN lower("purpose") LIKE '%contract%' THEN 'CONTRACTOR'::"VisitorPurpose"
    WHEN lower("purpose") LIKE '%deliver%' THEN 'DELIVERY'::"VisitorPurpose"
    WHEN lower("purpose") LIKE '%maint%' OR lower("purpose") LIKE '%plumb%' OR lower("purpose") LIKE '%fix%' THEN 'MAINTENANCE'::"VisitorPurpose"
    WHEN lower("purpose") LIKE '%govern%' OR lower("purpose") LIKE '%utilit%' THEN 'GOVERNMENT_UTILITIES'::"VisitorPurpose"
    ELSE 'OTHER'::"VisitorPurpose"
  END
);
ALTER TABLE "visitors" ALTER COLUMN "purpose" SET DEFAULT 'VISITOR'::"VisitorPurpose";

ALTER TABLE "favourite_visitors" ADD COLUMN "phoneCountryCode" TEXT NOT NULL DEFAULT '+60',
ADD COLUMN "entryMode" "VisitorEntryMode" NOT NULL DEFAULT 'WALK_IN';
