-- Add topicId to Session (nullable — links a session to its Subject)
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "topicId" TEXT;

ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_topicId_fkey";
ALTER TABLE "Session" ADD CONSTRAINT "Session_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Session_topicId_idx" ON "Session"("topicId");
