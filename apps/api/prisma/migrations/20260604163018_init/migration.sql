-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('EMAIL_VERIFY', 'PHONE_VERIFY', 'PASSWORD_RESET', 'LOGIN_OTP');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('OCCUPIED', 'VACANT', 'UNDER_RENO', 'RESERVED');

-- CreateEnum
CREATE TYPE "OwnershipStatus" AS ENUM ('ACTIVE', 'PENDING', 'ENDED');

-- CreateEnum
CREATE TYPE "TenancyStatus" AS ENUM ('ACTIVE', 'PENDING', 'TERMINATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RoleId" AS ENUM ('SUPER_ADMIN', 'MANAGEMENT_ADMIN', 'MANAGEMENT_STAFF', 'SECURITY_GUARD', 'UNIT_OWNER', 'TENANT', 'HOUSEHOLD_MEMBER', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('PLATFORM', 'CONDO', 'UNIT');

-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_IN', 'CHECKED_OUT', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'FPX', 'IPAY88', 'RAZER', 'MANUAL');

-- CreateEnum
CREATE TYPE "DefectSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('NEW', 'ACK', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "AttachmentOwner" AS ENUM ('DEFECT', 'DEFECT_UPDATE', 'ANNOUNCEMENT', 'PROFILE', 'GENERIC');

-- CreateEnum
CREATE TYPE "AnnouncementImportance" AS ENUM ('INFO', 'IMPORTANT', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('VISITOR_REQUEST', 'VISITOR_CHECKED_IN', 'VISITOR_CHECKED_OUT', 'INVOICE_ISSUED', 'INVOICE_DUE_SOON', 'INVOICE_PAID', 'DEFECT_UPDATE', 'ANNOUNCEMENT', 'ACCESS_GRANTED', 'ACCESS_REVOKED', 'AUDIT_ALERT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PushKind" AS ENUM ('EXPO', 'WEB');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'READ', 'LOGIN', 'LOGOUT', 'GRANT_ACCESS', 'REVOKE_ACCESS', 'PAYMENT', 'APPROVE', 'REJECT', 'ACK', 'EXPORT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "totpSecret" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceInfo" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkey_credentials" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "deviceType" TEXT,
    "transports" TEXT[],
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "passkey_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "identifier" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condos" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'MY',
    "currencyCode" TEXT NOT NULL DEFAULT 'MYR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "feeFormulaConfig" JSONB NOT NULL DEFAULT '{}',
    "brandColor" TEXT,
    "logoUrl" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "condos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "blockId" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "floor" INTEGER,
    "sqft" DECIMAL(10,2),
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "status" "UnitStatus" NOT NULL DEFAULT 'OCCUPIED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownerships" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sharePercent" DECIMAL(6,3) NOT NULL DEFAULT 100,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "status" "OwnershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenancies" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdByOwnershipId" UUID,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "TenancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "accessRestrictions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "relationship" TEXT,
    "addedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" "RoleId" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "RoleScope" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "roleId" "RoleId" NOT NULL,
    "userId" UUID NOT NULL,
    "condoId" UUID,
    "unitId" UUID,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "grantedByUserId" UUID,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitors" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "hostUserId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "identification" TEXT,
    "phone" TEXT,
    "vehiclePlate" TEXT,
    "purpose" TEXT,
    "expectedAt" TIMESTAMP(3) NOT NULL,
    "expectedDurationMins" INTEGER,
    "qrCode" TEXT NOT NULL,
    "status" "VisitorStatus" NOT NULL DEFAULT 'APPROVED',
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_check_ins" (
    "id" UUID NOT NULL,
    "visitorId" UUID NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkInGuardId" UUID,
    "checkOutAt" TIMESTAMP(3),
    "checkOutGuardId" UUID,
    "gateLocation" TEXT,
    "notes" TEXT,

    CONSTRAINT "visitor_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'MYR',
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "formula" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "userId" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'MYR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defects" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "unitId" UUID,
    "raisedByUserId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "DefectSeverity" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "status" "DefectStatus" NOT NULL DEFAULT 'NEW',
    "assignedToUserId" UUID,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_updates" (
    "id" UUID NOT NULL,
    "defectId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "statusFrom" "DefectStatus",
    "statusTo" "DefectStatus",
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defect_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "ownerKind" "AttachmentOwner" NOT NULL,
    "uploadedByUserId" UUID,
    "defectId" UUID,
    "defectUpdateId" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "importance" "AnnouncementImportance" NOT NULL DEFAULT 'INFO',
    "audience" JSONB NOT NULL DEFAULT '{}',
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "requiresAck" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_acks" (
    "id" UUID NOT NULL,
    "announcementId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_acks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "sentChannels" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "PushKind" NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "condoId" UUID,
    "unitId" UUID,
    "actorUserId" UUID,
    "actorRole" "RoleId",
    "action" "AuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "passkey_credentials_credentialId_key" ON "passkey_credentials"("credentialId");

-- CreateIndex
CREATE INDEX "passkey_credentials_userId_idx" ON "passkey_credentials"("userId");

-- CreateIndex
CREATE INDEX "verification_codes_identifier_purpose_idx" ON "verification_codes"("identifier", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "condos_slug_key" ON "condos"("slug");

-- CreateIndex
CREATE INDEX "blocks_condoId_idx" ON "blocks"("condoId");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_condoId_name_key" ON "blocks"("condoId", "name");

-- CreateIndex
CREATE INDEX "units_blockId_idx" ON "units"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "units_condoId_identifier_key" ON "units"("condoId", "identifier");

-- CreateIndex
CREATE INDEX "ownerships_unitId_idx" ON "ownerships"("unitId");

-- CreateIndex
CREATE INDEX "ownerships_userId_idx" ON "ownerships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ownerships_unitId_userId_startDate_key" ON "ownerships"("unitId", "userId", "startDate");

-- CreateIndex
CREATE INDEX "tenancies_unitId_idx" ON "tenancies"("unitId");

-- CreateIndex
CREATE INDEX "tenancies_userId_idx" ON "tenancies"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_unitId_userId_key" ON "household_members"("unitId", "userId");

-- CreateIndex
CREATE INDEX "role_assignments_userId_idx" ON "role_assignments"("userId");

-- CreateIndex
CREATE INDEX "role_assignments_condoId_idx" ON "role_assignments"("condoId");

-- CreateIndex
CREATE INDEX "role_assignments_unitId_idx" ON "role_assignments"("unitId");

-- CreateIndex
CREATE INDEX "role_assignments_roleId_idx" ON "role_assignments"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "visitors_qrCode_key" ON "visitors"("qrCode");

-- CreateIndex
CREATE INDEX "visitors_condoId_idx" ON "visitors"("condoId");

-- CreateIndex
CREATE INDEX "visitors_unitId_idx" ON "visitors"("unitId");

-- CreateIndex
CREATE INDEX "visitors_hostUserId_idx" ON "visitors"("hostUserId");

-- CreateIndex
CREATE INDEX "visitors_status_idx" ON "visitors"("status");

-- CreateIndex
CREATE INDEX "visitors_expectedAt_idx" ON "visitors"("expectedAt");

-- CreateIndex
CREATE INDEX "visitor_check_ins_visitorId_idx" ON "visitor_check_ins"("visitorId");

-- CreateIndex
CREATE INDEX "invoices_condoId_status_idx" ON "invoices"("condoId", "status");

-- CreateIndex
CREATE INDEX "invoices_unitId_idx" ON "invoices"("unitId");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_condoId_number_key" ON "invoices"("condoId", "number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoiceId_idx" ON "invoice_lines"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_providerRef_idx" ON "payments"("providerRef");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "defects_condoId_status_idx" ON "defects"("condoId", "status");

-- CreateIndex
CREATE INDEX "defects_unitId_idx" ON "defects"("unitId");

-- CreateIndex
CREATE INDEX "defects_raisedByUserId_idx" ON "defects"("raisedByUserId");

-- CreateIndex
CREATE INDEX "defects_assignedToUserId_idx" ON "defects"("assignedToUserId");

-- CreateIndex
CREATE INDEX "defect_updates_defectId_idx" ON "defect_updates"("defectId");

-- CreateIndex
CREATE INDEX "attachments_defectId_idx" ON "attachments"("defectId");

-- CreateIndex
CREATE INDEX "attachments_defectUpdateId_idx" ON "attachments"("defectUpdateId");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_bucket_key_key" ON "attachments"("bucket", "key");

-- CreateIndex
CREATE INDEX "announcements_condoId_publishedAt_idx" ON "announcements"("condoId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_acks_announcementId_userId_key" ON "announcement_acks"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_kind_token_key" ON "push_subscriptions"("kind", "token");

-- CreateIndex
CREATE INDEX "audit_logs_condoId_createdAt_idx" ON "audit_logs"("condoId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_unitId_createdAt_idx" ON "audit_logs"("unitId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkey_credentials" ADD CONSTRAINT "passkey_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownerships" ADD CONSTRAINT "ownerships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_createdByOwnershipId_fkey" FOREIGN KEY ("createdByOwnershipId") REFERENCES "ownerships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_check_ins" ADD CONSTRAINT "visitor_check_ins_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_check_ins" ADD CONSTRAINT "visitor_check_ins_checkInGuardId_fkey" FOREIGN KEY ("checkInGuardId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_check_ins" ADD CONSTRAINT "visitor_check_ins_checkOutGuardId_fkey" FOREIGN KEY ("checkOutGuardId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_updates" ADD CONSTRAINT "defect_updates_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "defects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_updates" ADD CONSTRAINT "defect_updates_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "defects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_defectUpdateId_fkey" FOREIGN KEY ("defectUpdateId") REFERENCES "defect_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_acks" ADD CONSTRAINT "announcement_acks_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_acks" ADD CONSTRAINT "announcement_acks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
