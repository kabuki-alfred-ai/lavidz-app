-- AlterTable
ALTER TABLE "Session" ADD COLUMN "montageSettings" JSONB;

-- AlterTable
ALTER TABLE "Recording" ADD COLUMN "ttsAudioKey" TEXT,
ADD COLUMN "ttsVoiceId" TEXT,
ADD COLUMN "processedVideoKey" TEXT,
ADD COLUMN "processingHash" TEXT;
