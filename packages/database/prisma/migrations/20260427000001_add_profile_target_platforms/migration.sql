-- AlterTable
ALTER TABLE "EntrepreneurProfile" ADD COLUMN "targetPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[];
