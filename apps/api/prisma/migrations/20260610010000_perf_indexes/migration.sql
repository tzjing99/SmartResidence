-- Performance indexes (additive; no data changes, no behavior changes).
-- See apps/api: visitor list/stats, thread transcript reads, notification feeds.

-- Visitor: condo-scoped, date-bounded lists & stats (guard boards, admin dashboards).
CREATE INDEX IF NOT EXISTS "visitors_condoId_expectedAt_idx" ON "visitors"("condoId", "expectedAt");

-- Notification: list feed is filtered by userId and ordered by createdAt desc.
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- ThreadMessage: per-thread transcript reads are ordered by createdAt asc.
-- Replace the single-column index with a composite that also covers ordering.
DROP INDEX IF EXISTS "thread_messages_threadId_idx";
CREATE INDEX IF NOT EXISTS "thread_messages_threadId_createdAt_idx" ON "thread_messages"("threadId", "createdAt");
