-- Governance v0.6 MVP: AGM/EGM meetings, proxies, resolutions linked to polls

CREATE TYPE "GeneralMeetingKind" AS ENUM ('AGM', 'EGM');
CREATE TYPE "GeneralMeetingStatus" AS ENUM ('DRAFT', 'NOTICE_PUBLISHED', 'IN_PROGRESS', 'CLOSED');

CREATE TABLE "general_meetings" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "kind" "GeneralMeetingKind" NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "noticeBody" TEXT NOT NULL DEFAULT '',
    "status" "GeneralMeetingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "general_meetings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meeting_proxies" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "proxyHolderName" TEXT NOT NULL,
    "proxyHolderContact" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_proxies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meeting_resolutions" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "pollId" UUID,
    "votingOpensAt" TIMESTAMP(3),
    "votingClosesAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_resolutions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meeting_resolutions_pollId_key" ON "meeting_resolutions"("pollId");
CREATE UNIQUE INDEX "meeting_proxies_meetingId_unitId_key" ON "meeting_proxies"("meetingId", "unitId");
CREATE INDEX "meeting_proxies_meetingId_idx" ON "meeting_proxies"("meetingId");
CREATE INDEX "meeting_proxies_ownerUserId_idx" ON "meeting_proxies"("ownerUserId");
CREATE INDEX "meeting_resolutions_meetingId_idx" ON "meeting_resolutions"("meetingId");
CREATE INDEX "general_meetings_condoId_status_idx" ON "general_meetings"("condoId", "status");
CREATE INDEX "general_meetings_condoId_scheduledAt_idx" ON "general_meetings"("condoId", "scheduledAt");

ALTER TABLE "general_meetings" ADD CONSTRAINT "general_meetings_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "general_meetings" ADD CONSTRAINT "general_meetings_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meeting_proxies" ADD CONSTRAINT "meeting_proxies_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "general_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_proxies" ADD CONSTRAINT "meeting_proxies_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_proxies" ADD CONSTRAINT "meeting_proxies_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_resolutions" ADD CONSTRAINT "meeting_resolutions_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "general_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_resolutions" ADD CONSTRAINT "meeting_resolutions_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'MEETING_NOTICE_PUBLISHED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PROXY_RECEIVED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'RESOLUTION_OPEN';
