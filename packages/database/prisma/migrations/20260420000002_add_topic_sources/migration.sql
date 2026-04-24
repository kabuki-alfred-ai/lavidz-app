-- AlterTable
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "sources" JSONB;
