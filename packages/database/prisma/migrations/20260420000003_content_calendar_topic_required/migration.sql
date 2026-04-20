-- Migration: ContentCalendar.topicId becomes required.
-- The string "topic" column is dropped : the Sujet is now the atom, and every
-- calendar entry must reference one. Legacy rows without a topicId are
-- backfilled : we first try to link to an existing Topic with the same name
-- (case-insensitive) within the same organization, then create a seed Topic
-- for any remaining row so nothing is lost.

-- 1) Link rows whose "topic" string already matches an existing Topic
UPDATE "ContentCalendar" cc
SET "topicId" = t.id
FROM "Topic" t
WHERE cc."topicId" IS NULL
  AND t."organizationId" = cc."organizationId"
  AND LOWER(TRIM(t."name")) = LOWER(TRIM(cc."topic"));

-- 2) Create a seed Topic for every remaining ContentCalendar row (one-to-one)
--    IDs are derived deterministically from cc.id so step 3 can re-link without
--    needing RETURNING + extra joins.
INSERT INTO "Topic" (
  id, "organizationId", name, slug, status, "threadId", "createdAt", "updatedAt"
)
SELECT
  'cmig' || SUBSTR(MD5(cc.id), 1, 21),
  cc."organizationId",
  COALESCE(NULLIF(TRIM(cc."topic"), ''), 'Sujet sans nom'),
  LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(COALESCE(NULLIF(TRIM(cc."topic"), ''), 'sujet-sans-nom'), '[^a-zA-Z0-9]+', '-', 'g'),
      '^-+|-+$',
      '',
      'g'
    )
  ) || '-mig-' || SUBSTR(MD5(cc.id), 1, 8),
  'DRAFT'::"TopicStatus",
  'cmth' || SUBSTR(MD5(cc.id || 'thread'), 1, 21),
  cc."createdAt",
  cc."updatedAt"
FROM "ContentCalendar" cc
WHERE cc."topicId" IS NULL;

-- 3) Link remaining rows to their freshly-created Topic (same derived id)
UPDATE "ContentCalendar" cc
SET "topicId" = 'cmig' || SUBSTR(MD5(cc.id), 1, 21)
WHERE cc."topicId" IS NULL;

-- 4) Drop the obsolete string column
ALTER TABLE "ContentCalendar" DROP COLUMN "topic";

-- 5) topicId is now NOT NULL
ALTER TABLE "ContentCalendar" ALTER COLUMN "topicId" SET NOT NULL;

-- 6) Upgrade the foreign key from SetNull (old nullable) to Cascade
ALTER TABLE "ContentCalendar" DROP CONSTRAINT IF EXISTS "ContentCalendar_topicId_fkey";
ALTER TABLE "ContentCalendar" ADD CONSTRAINT "ContentCalendar_topicId_fkey"
  FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE;

-- 7) Index for the now-required relation
CREATE INDEX IF NOT EXISTS "ContentCalendar_topicId_idx" ON "ContentCalendar"("topicId");
