-- Owner-verified governance polls (MC consultation)

CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
CREATE TYPE "PollAudienceScope" AS ENUM ('ALL_OWNERS', 'BLOCK');

CREATE TABLE "polls" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "PollStatus" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "createdByUserId" UUID NOT NULL,
    "audienceScope" "PollAudienceScope" NOT NULL DEFAULT 'ALL_OWNERS',
    "blockIds" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "poll_options" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "poll_votes" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ownershipId" UUID NOT NULL,
    "weight" DECIMAL(6,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "poll_votes_pollId_unitId_key" ON "poll_votes"("pollId", "unitId");
CREATE INDEX "poll_votes_pollId_idx" ON "poll_votes"("pollId");
CREATE INDEX "poll_votes_userId_idx" ON "poll_votes"("userId");
CREATE INDEX "poll_options_pollId_idx" ON "poll_options"("pollId");
CREATE INDEX "polls_condoId_status_idx" ON "polls"("condoId", "status");
CREATE INDEX "polls_condoId_createdAt_idx" ON "polls"("condoId", "createdAt");

ALTER TABLE "polls" ADD CONSTRAINT "polls_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "polls" ADD CONSTRAINT "polls_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_ownershipId_fkey" FOREIGN KEY ("ownershipId") REFERENCES "ownerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
