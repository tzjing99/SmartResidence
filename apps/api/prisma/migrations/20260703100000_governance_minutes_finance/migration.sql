-- Governance v0.6: meeting minutes publication + financial snapshot on notice

ALTER TABLE "general_meetings" ADD COLUMN "minutesBody" TEXT NOT NULL DEFAULT '';
ALTER TABLE "general_meetings" ADD COLUMN "minutesPublishedAt" TIMESTAMP(3);
ALTER TABLE "general_meetings" ADD COLUMN "financialSnapshot" JSONB;
