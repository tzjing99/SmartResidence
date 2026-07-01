-- Delivery and e-hailing quick-entry visitor passes

CREATE TYPE "VisitorPassKind" AS ENUM ('STANDARD', 'DELIVERY', 'E_HAILING');

CREATE TYPE "DeliveryPlatform" AS ENUM ('GRABFOOD', 'FOODPANDA', 'SHOPEE_FOOD', 'GRAB', 'OTHER');

ALTER TABLE "visitors" ADD COLUMN "passKind" "VisitorPassKind" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "visitors" ADD COLUMN "deliveryPlatform" "DeliveryPlatform";

CREATE INDEX "visitors_condoId_passKind_idx" ON "visitors"("condoId", "passKind");
