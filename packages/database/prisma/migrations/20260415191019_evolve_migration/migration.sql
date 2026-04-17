/*
  Warnings:

  - You are about to drop the column `contentTsv` on the `ConversationMemory` table. All the data in the column will be lost.
  - Made the column `embedding` on table `ConversationMemory` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "VoiceTone" AS ENUM ('PROFESSIONAL', 'CASUAL', 'EXPERT', 'ENERGETIC', 'INSPIRATIONAL');

-- CreateEnum
CREATE TYPE "BRollSource" AS ENUM ('USER', 'PEXELS', 'UNSPLASH');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('QUESTION_BOX', 'TELEPROMPTER', 'HOT_TAKE', 'STORYTELLING', 'DAILY_TIP', 'MYTH_VS_REALITY');

-- CreateEnum
CREATE TYPE "ContentCalendarStatus" AS ENUM ('PLANNED', 'RECORDED', 'EDITING', 'DELIVERED', 'PUBLISHED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CompositionStatus" AS ENUM ('DRAFT', 'RENDERING', 'DONE', 'FAILED');

-- DropIndex
DROP INDEX "ConversationMemory_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "ConversationMemory_tsv_gin_idx";

-- AlterTable
ALTER TABLE "ConversationMemory" DROP COLUMN "contentTsv",
ALTER COLUMN "embedding" SET NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "contentFormat" "ContentFormat",
ADD COLUMN     "targetPlatforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "teleprompterScript" TEXT;

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#FF4D1C',
    "secondaryColor" TEXT NOT NULL DEFAULT '#1A1A2E',
    "accentColor" TEXT NOT NULL DEFAULT '#E94560',
    "fontTitle" TEXT NOT NULL DEFAULT 'Inter',
    "fontBody" TEXT NOT NULL DEFAULT 'Inter',
    "logoUrl" TEXT,
    "introVideoUrl" TEXT,
    "outroVideoUrl" TEXT,
    "watermark" JSONB,
    "voiceTone" "VoiceTone" NOT NULL DEFAULT 'PROFESSIONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BRoll" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" "BRollSource" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duration" DOUBLE PRECISION,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BRoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCalendar" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "format" "ContentFormat" NOT NULL,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ContentCalendarStatus" NOT NULL DEFAULT 'PLANNED',
    "sessionId" TEXT,
    "aiSuggestions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Composition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT,
    "platform" TEXT,
    "aspectRatio" TEXT NOT NULL DEFAULT '9:16',
    "timeline" JSONB,
    "brollPlacements" JSONB,
    "brandKitApplied" BOOLEAN NOT NULL DEFAULT true,
    "status" "CompositionStatus" NOT NULL DEFAULT 'DRAFT',
    "outputUrl" TEXT,
    "renderJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Composition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_organizationId_key" ON "BrandKit"("organizationId");

-- CreateIndex
CREATE INDEX "BRoll_organizationId_idx" ON "BRoll"("organizationId");

-- CreateIndex
CREATE INDEX "BRoll_tags_idx" ON "BRoll"("tags");

-- CreateIndex
CREATE INDEX "ContentCalendar_organizationId_idx" ON "ContentCalendar"("organizationId");

-- CreateIndex
CREATE INDEX "ContentCalendar_scheduledDate_idx" ON "ContentCalendar"("scheduledDate");

-- CreateIndex
CREATE INDEX "Composition_organizationId_idx" ON "Composition"("organizationId");

-- CreateIndex
CREATE INDEX "Composition_sessionId_idx" ON "Composition"("sessionId");

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BRoll" ADD CONSTRAINT "BRoll_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendar" ADD CONSTRAINT "ContentCalendar_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
