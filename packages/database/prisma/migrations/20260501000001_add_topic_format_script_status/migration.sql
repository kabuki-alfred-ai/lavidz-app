-- Add FILMING and DONE values to TopicStatus enum
ALTER TYPE "TopicStatus" ADD VALUE IF NOT EXISTS 'FILMING';
ALTER TYPE "TopicStatus" ADD VALUE IF NOT EXISTS 'DONE';

-- Add format and script columns to Topic
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "format" "ContentFormat";
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "script" JSONB;
