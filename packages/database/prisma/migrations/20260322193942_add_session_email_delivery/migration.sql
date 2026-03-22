-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'SUBMITTED';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "finalVideoKey" TEXT,
ADD COLUMN     "recipientEmail" TEXT,
ADD COLUMN     "recipientName" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);
