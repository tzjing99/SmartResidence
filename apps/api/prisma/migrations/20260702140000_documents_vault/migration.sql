-- Documents vault: role-scoped folders, versioned condo document library.

CREATE TYPE "DocumentFolderAudience" AS ENUM ('ALL', 'OWNERS', 'MANAGEMENT');

CREATE TABLE "document_folders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "condoId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "audience" "DocumentFolderAudience" NOT NULL DEFAULT 'ALL',
  "position" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "folderId" UUID NOT NULL,
  "condoId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "currentVersionId" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "fileKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "uploadedByUserId" UUID NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "documents_currentVersionId_key" ON "documents"("currentVersionId");
CREATE INDEX "document_folders_condoId_active_idx" ON "document_folders"("condoId", "active");
CREATE INDEX "documents_condoId_folderId_idx" ON "documents"("condoId", "folderId");
CREATE INDEX "documents_folderId_idx" ON "documents"("folderId");
CREATE UNIQUE INDEX "document_versions_documentId_versionNumber_key" ON "document_versions"("documentId", "versionNumber");
CREATE INDEX "document_versions_documentId_idx" ON "document_versions"("documentId");

ALTER TABLE "document_folders"
  ADD CONSTRAINT "document_folders_condoId_fkey"
  FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "document_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_condoId_fkey"
  FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_currentVersionId_fkey"
  FOREIGN KEY ("currentVersionId") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_versions"
  ADD CONSTRAINT "document_versions_uploadedByUserId_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "AttachmentOwner" ADD VALUE IF NOT EXISTS 'DOCUMENT_VERSION';

ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "documentVersionId" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "attachments_documentVersionId_key" ON "attachments"("documentVersionId");

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_documentVersionId_fkey"
  FOREIGN KEY ("documentVersionId") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'DOCUMENT_PUBLISHED';
