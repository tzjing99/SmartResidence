-- CreateEnum
CREATE TYPE "McpTransport" AS ENUM ('STREAMABLE_HTTP', 'HTTP_SSE', 'STDIO');

-- CreateEnum
CREATE TYPE "McpConnectionTestStatus" AS ENUM ('UNTESTED', 'OK', 'FAILED');

-- CreateTable
CREATE TABLE "mcp_server_connections" (
    "id" UUID NOT NULL,
    "condoId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "transport" "McpTransport" NOT NULL DEFAULT 'STREAMABLE_HTTP',
    "serverUrl" TEXT,
    "publicConfig" JSONB NOT NULL DEFAULT '{}',
    "encryptedSecret" BYTEA,
    "secretIv" BYTEA,
    "secretAuthTag" BYTEA,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastTestStatus" "McpConnectionTestStatus" NOT NULL DEFAULT 'UNTESTED',
    "lastTestMessage" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_server_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_server_connections_condoId_idx" ON "mcp_server_connections"("condoId");

-- AddForeignKey
ALTER TABLE "mcp_server_connections" ADD CONSTRAINT "mcp_server_connections_condoId_fkey" FOREIGN KEY ("condoId") REFERENCES "condos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
