-- Full AGM/EGM e-voting: share-weighted quorum, eligibility freeze, immutable ballot audit

ALTER TABLE "general_meetings" ADD COLUMN "quorumPercent" DECIMAL(6,3) NOT NULL DEFAULT 50;

ALTER TABLE "meeting_resolutions" ADD COLUMN "eligibilitySnapshot" JSONB;

ALTER TABLE "poll_votes" ADD COLUMN "viaProxy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "poll_votes" ADD COLUMN "proxyId" UUID;
ALTER TABLE "poll_votes" ADD COLUMN "meetingId" UUID;
ALTER TABLE "poll_votes" ADD COLUMN "ownerUserId" UUID;

CREATE INDEX "poll_votes_meetingId_idx" ON "poll_votes"("meetingId");
