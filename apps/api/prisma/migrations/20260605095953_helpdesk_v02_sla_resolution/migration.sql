-- AlterTable
ALTER TABLE "threads" ADD COLUMN     "reopenCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resolutionProposedMessageId" UUID;

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_resolutionProposedMessageId_fkey" FOREIGN KEY ("resolutionProposedMessageId") REFERENCES "thread_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
