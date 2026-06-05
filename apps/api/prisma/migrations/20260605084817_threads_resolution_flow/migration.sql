-- AlterEnum
ALTER TYPE "ThreadStatus" ADD VALUE 'PENDING_RESIDENT_CONFIRMATION';

-- AlterTable
ALTER TABLE "threads" ADD COLUMN     "resolutionProposedAt" TIMESTAMP(3),
ADD COLUMN     "resolutionProposedByUserId" UUID;
