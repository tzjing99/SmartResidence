-- CreateEnum
CREATE TYPE "ThreadCategory" AS ENUM ('BILLING', 'MAINTENANCE', 'FACILITY', 'SECURITY', 'COMPLAINT', 'SUGGESTION', 'GOVERNANCE', 'GENERAL');

-- CreateEnum
CREATE TYPE "ThreadPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'AWAITING_RESIDENT', 'AWAITING_MANAGEMENT', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "ThreadMessageKind" AS ENUM ('MESSAGE', 'INTERNAL_NOTE', 'SYSTEM');

-- AlterEnum
ALTER TYPE "AttachmentOwner" ADD VALUE 'THREAD_MESSAGE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'THREAD_MESSAGE';
ALTER TYPE "NotificationKind" ADD VALUE 'THREAD_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'THREAD_STATUS';
ALTER TYPE "NotificationKind" ADD VALUE 'THREAD_SLA_ESCALATION';

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "threadMessageId" UUID;

-- CreateTable
CREATE TABLE "threads" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "unitId" UUID,
    "createdByUserId" UUID NOT NULL,
    "assignedToUserId" UUID,
    "subject" TEXT NOT NULL,
    "category" "ThreadCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "ThreadPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ThreadStatus" NOT NULL DEFAULT 'OPEN',
    "slaPolicyId" UUID,
    "firstResponseDueAt" TIMESTAMP(3),
    "resolutionDueAt" TIMESTAMP(3),
    "firstRespondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_messages" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "kind" "ThreadMessageKind" NOT NULL DEFAULT 'MESSAGE',
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_participants" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "priority" "ThreadPriority" NOT NULL,
    "firstResponseMins" INTEGER NOT NULL,
    "resolutionMins" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_categories" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_articles" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "categoryId" UUID,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tags" TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "authorUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "threads_condoId_status_idx" ON "threads"("condoId", "status");

-- CreateIndex
CREATE INDEX "threads_unitId_idx" ON "threads"("unitId");

-- CreateIndex
CREATE INDEX "threads_createdByUserId_idx" ON "threads"("createdByUserId");

-- CreateIndex
CREATE INDEX "threads_assignedToUserId_idx" ON "threads"("assignedToUserId");

-- CreateIndex
CREATE INDEX "threads_priority_idx" ON "threads"("priority");

-- CreateIndex
CREATE INDEX "thread_messages_threadId_idx" ON "thread_messages"("threadId");

-- CreateIndex
CREATE INDEX "thread_participants_userId_idx" ON "thread_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "thread_participants_threadId_userId_key" ON "thread_participants"("threadId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_condoId_priority_key" ON "sla_policies"("condoId", "priority");

-- CreateIndex
CREATE INDEX "faq_categories_condoId_idx" ON "faq_categories"("condoId");

-- CreateIndex
CREATE INDEX "faq_articles_condoId_published_idx" ON "faq_articles"("condoId", "published");

-- CreateIndex
CREATE INDEX "faq_articles_categoryId_idx" ON "faq_articles"("categoryId");

-- CreateIndex
CREATE INDEX "attachments_threadMessageId_idx" ON "attachments"("threadMessageId");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_threadMessageId_fkey" FOREIGN KEY ("threadMessageId") REFERENCES "thread_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_categories" ADD CONSTRAINT "faq_categories_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_articles" ADD CONSTRAINT "faq_articles_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_articles" ADD CONSTRAINT "faq_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "faq_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_articles" ADD CONSTRAINT "faq_articles_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
