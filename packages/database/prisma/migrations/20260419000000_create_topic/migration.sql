-- CreateEnum
CREATE TYPE IF NOT EXISTS "TopicStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "Topic" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brief" TEXT,
    "status" "TopicStatus" NOT NULL DEFAULT 'DRAFT',
    "threadId" TEXT NOT NULL,
    "pillar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Topic_threadId_key" ON "Topic"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Topic_organizationId_slug_key" ON "Topic"("organizationId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Topic_organizationId_idx" ON "Topic"("organizationId");

-- AddForeignKey
ALTER TABLE "Topic" DROP CONSTRAINT IF EXISTS "Topic_organizationId_fkey";
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
