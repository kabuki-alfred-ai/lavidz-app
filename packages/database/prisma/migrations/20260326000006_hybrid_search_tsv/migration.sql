-- Add generated tsvector column for French full-text search.
-- GENERATED ALWAYS AS ... STORED: PostgreSQL updates it automatically on INSERT/UPDATE.
ALTER TABLE "ConversationMemory"
  ADD COLUMN "contentTsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('french', content)) STORED;

-- GIN index for fast full-text lookups
CREATE INDEX "ConversationMemory_tsv_gin_idx"
  ON "ConversationMemory" USING GIN ("contentTsv");
