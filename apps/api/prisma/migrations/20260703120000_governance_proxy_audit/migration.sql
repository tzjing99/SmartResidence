-- Governance: proxy holder user link + immutable resolution results snapshot

ALTER TABLE "meeting_proxies" ADD COLUMN "proxyHolderUserId" UUID;

ALTER TABLE "meeting_resolutions" ADD COLUMN "resultsSnapshot" JSONB;

CREATE INDEX "meeting_proxies_proxyHolderUserId_idx" ON "meeting_proxies"("proxyHolderUserId");

ALTER TABLE "meeting_proxies" ADD CONSTRAINT "meeting_proxies_proxyHolderUserId_fkey" FOREIGN KEY ("proxyHolderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
