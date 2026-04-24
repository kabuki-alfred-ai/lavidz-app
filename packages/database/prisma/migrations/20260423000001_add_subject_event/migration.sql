-- SubjectEvent : fil du sujet (§05 sur la page Sujet detail). Chaque ligne
-- trace une décision ou mutation utile à relire : création de sujet, édition
-- d'angle, ajout de source, lancement de tournage, enrichissement par Kabou.

CREATE TABLE "SubjectEvent" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'user',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubjectEvent_topicId_createdAt_idx" ON "SubjectEvent"("topicId", "createdAt");

ALTER TABLE "SubjectEvent"
    ADD CONSTRAINT "SubjectEvent_topicId_fkey"
    FOREIGN KEY ("topicId")
    REFERENCES "Topic"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Backfill : pour chaque Topic existant, on synthétise un event topic_created
-- à createdAt. Les sessions existantes génèrent un session_created à leur
-- propre createdAt. Ça peuple le fil immédiatement pour les sujets déjà en vie.
INSERT INTO "SubjectEvent" ("id", "topicId", "type", "actor", "metadata", "createdAt")
SELECT
    gen_random_uuid()::text,
    "id",
    'topic_created',
    'user',
    jsonb_build_object('name', "name"),
    "createdAt"
FROM "Topic";

INSERT INTO "SubjectEvent" ("id", "topicId", "type", "actor", "metadata", "createdAt")
SELECT
    gen_random_uuid()::text,
    "topicId",
    'session_created',
    'user',
    jsonb_build_object('sessionId', "id", 'contentFormat', "contentFormat"),
    "createdAt"
FROM "Session"
WHERE "topicId" IS NOT NULL;
