-- Subject → Session → Recording → Project refactor
-- Stratégie : dual-write, toutes les nouvelles colonnes sont nullable (backward compat).

-- ============================================================================
-- Topic (F9 dual-write — recordingGuide / hooks legacy restent en place)
-- ============================================================================
ALTER TABLE "Topic" ADD COLUMN "narrativeAnchor" JSONB;
ALTER TABLE "Topic" ADD COLUMN "hookDraft" JSONB;

-- Backfill narrativeAnchor depuis recordingGuide existant, shape { kind: 'draft', bullets, updatedAt }
-- - Si recordingGuide est déjà kind='draft' : copie directe
-- - Si recordingGuide est format-specific avec sourceDraft.bullets : on récupère les bullets
-- - Sinon : NULL (reshape nécessaire côté user pour récupérer un anchor)
UPDATE "Topic"
  SET "narrativeAnchor" = CASE
    WHEN "recordingGuide"->>'kind' = 'draft' THEN jsonb_build_object(
      'kind', 'draft',
      'bullets', COALESCE("recordingGuide"->'bullets', '[]'::jsonb),
      'updatedAt', to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
    WHEN "recordingGuide"->'sourceDraft'->'bullets' IS NOT NULL THEN jsonb_build_object(
      'kind', 'draft',
      'bullets', "recordingGuide"->'sourceDraft'->'bullets',
      'updatedAt', to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
    ELSE NULL
  END
  WHERE "recordingGuide" IS NOT NULL;

-- ============================================================================
-- Session
-- ============================================================================
ALTER TABLE "Session" ADD COLUMN "recordingScript" JSONB;
ALTER TABLE "Session" ADD COLUMN "hooks" JSONB;
ALTER TABLE "Session" ADD COLUMN "lastActivityAt" TIMESTAMP(3);

-- ============================================================================
-- Recording
-- ============================================================================
ALTER TABLE "Recording" ADD COLUMN "supersededAt" TIMESTAMP(3);
ALTER TABLE "Recording" ADD COLUMN "kabouRecommendation" JSONB;

-- ============================================================================
-- ConversationMemory : scope topic-level pour RAG
-- ============================================================================
ALTER TABLE "ConversationMemory"
  ADD COLUMN "topicId" TEXT,
  ADD CONSTRAINT "ConversationMemory_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- F6 — index composite pour query topic-scoped performante
CREATE INDEX "ConversationMemory_profileId_topicId_idx"
  ON "ConversationMemory"("profileId", "topicId");

-- F6 — backfill topicId depuis Session.topicId pour les memories historiques
-- (sinon RAG topic-scoped retournerait 0 pour users existants)
UPDATE "ConversationMemory" m
  SET "topicId" = s."topicId"
  FROM "Session" s
  WHERE m."sessionId" = s."id"
    AND s."topicId" IS NOT NULL
    AND m."topicId" IS NULL;

-- ============================================================================
-- Project.sessionId — unique constraint (F5)
-- ============================================================================
-- ⚠️ PRE-CHECK manuel AVANT cette migration :
--   SELECT "sessionId", count(*) FROM "Project" WHERE "sessionId" IS NOT NULL
--   GROUP BY "sessionId" HAVING count(*) > 1;
-- Si > 0 lignes : dédupliquer manuellement (garder le plus ancien, orphaner les clips)
-- avant d'appliquer cette migration, sinon l'ALTER TABLE échouera.
ALTER TABLE "Project" ADD CONSTRAINT "Project_sessionId_key" UNIQUE ("sessionId");

-- ============================================================================
-- Session — unique index partiel "1 canonical per (topicId, contentFormat)" (F4)
-- ============================================================================
-- Les sessions REPLACED / FAILED ne comptent pas comme canoniques.
-- ⚠️ PRE-CHECK manuel AVANT cette migration :
--   SELECT "topicId", "contentFormat", count(*) FROM "Session"
--   WHERE "status" NOT IN ('REPLACED', 'FAILED')
--     AND "topicId" IS NOT NULL
--     AND "contentFormat" IS NOT NULL
--   GROUP BY "topicId", "contentFormat" HAVING count(*) > 1;
-- Si doublons : marquer le plus ancien en REPLACED avant d'appliquer.
CREATE UNIQUE INDEX "Session_topicId_contentFormat_canonical_unique"
  ON "Session"("topicId", "contentFormat")
  WHERE "status" NOT IN ('REPLACED', 'FAILED')
    AND "topicId" IS NOT NULL
    AND "contentFormat" IS NOT NULL;

-- ============================================================================
-- Recording — unique index partiel "1 canonical per (sessionId, questionId)" (F10)
-- ============================================================================
-- Defense-in-depth : si une race échappe à la transaction applicative Prisma,
-- la DB refuse la 2e insertion canonique.
CREATE UNIQUE INDEX "Recording_sessionId_questionId_canonical_unique"
  ON "Recording"("sessionId", "questionId")
  WHERE "supersededAt" IS NULL;
