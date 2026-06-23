-- AlterTable
ALTER TABLE "visitors" ADD COLUMN     "admittedByGuardUserId" UUID;

-- AddForeignKey
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_admittedByGuardUserId_fkey" FOREIGN KEY ("admittedByGuardUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
