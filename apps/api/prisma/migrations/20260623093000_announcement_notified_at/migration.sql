-- Tracks when the "published" push notification has been sent, so scheduled
-- notices (published later by the sweeper) and immediately-published notices
-- never double-notify residents.
ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);
