/*
  Warnings:

  - Made the column `purpose` on table `visitors` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'VISITOR_WALK_IN_REQUEST';

-- AlterTable
ALTER TABLE "visitors" ALTER COLUMN "purpose" SET NOT NULL;
