-- CreateEnum
CREATE TYPE "SoundTag" AS ENUM ('TRANSITION', 'INTRO', 'OUTRO');

-- CreateTable
CREATE TABLE "SoundAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" "SoundTag" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoundAsset_pkey" PRIMARY KEY ("id")
);
