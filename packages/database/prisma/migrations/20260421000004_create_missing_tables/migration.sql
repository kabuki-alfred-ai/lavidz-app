-- Catch-up migration: tables created via prisma db push, never captured in migrations.
-- All statements use IF NOT EXISTS for idempotency.

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectStatus') THEN
    CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'EDITING', 'RENDERING', 'DONE', 'FAILED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GeneratedPostPlatform') THEN
    CREATE TYPE "GeneratedPostPlatform" AS ENUM ('LINKEDIN', 'X', 'THREADS');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GeneratedPostVariant') THEN
    CREATE TYPE "GeneratedPostVariant" AS ENUM ('SHORT', 'LONG', 'STORY');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GeneratedPostStatus') THEN
    CREATE TYPE "GeneratedPostStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED');
  END IF;
END $$;

-- ChatMessage
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChatMessage_organizationId_createdAt_idx"
    ON "ChatMessage"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatMessage_organizationId_threadId_createdAt_idx"
    ON "ChatMessage"("organizationId", "threadId", "createdAt");

-- Project
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "montageSettings" JSONB,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Project_organizationId_idx" ON "Project"("organizationId");

ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_organizationId_fkey";
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_sessionId_fkey";
ALTER TABLE "Project" ADD CONSTRAINT "Project_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProjectClip
CREATE TABLE IF NOT EXISTS "ProjectClip" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "visibleRanges" JSONB,
    CONSTRAINT "ProjectClip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectClip_projectId_recordingId_key"
    ON "ProjectClip"("projectId", "recordingId");

CREATE INDEX IF NOT EXISTS "ProjectClip_projectId_idx" ON "ProjectClip"("projectId");

ALTER TABLE "ProjectClip" DROP CONSTRAINT IF EXISTS "ProjectClip_projectId_fkey";
ALTER TABLE "ProjectClip" ADD CONSTRAINT "ProjectClip_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectClip" DROP CONSTRAINT IF EXISTS "ProjectClip_recordingId_fkey";
ALTER TABLE "ProjectClip" ADD CONSTRAINT "ProjectClip_recordingId_fkey"
    FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GeneratedPost
CREATE TABLE IF NOT EXISTS "GeneratedPost" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platform" "GeneratedPostPlatform" NOT NULL DEFAULT 'LINKEDIN',
    "variant" "GeneratedPostVariant" NOT NULL DEFAULT 'LONG',
    "content" TEXT NOT NULL,
    "status" "GeneratedPostStatus" NOT NULL DEFAULT 'DRAFT',
    "topicId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeneratedPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GeneratedPost_organizationId_idx" ON "GeneratedPost"("organizationId");
CREATE INDEX IF NOT EXISTS "GeneratedPost_topicId_idx" ON "GeneratedPost"("topicId");
CREATE INDEX IF NOT EXISTS "GeneratedPost_sessionId_idx" ON "GeneratedPost"("sessionId");

ALTER TABLE "GeneratedPost" DROP CONSTRAINT IF EXISTS "GeneratedPost_organizationId_fkey";
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratedPost" DROP CONSTRAINT IF EXISTS "GeneratedPost_topicId_fkey";
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratedPost" DROP CONSTRAINT IF EXISTS "GeneratedPost_sessionId_fkey";
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
