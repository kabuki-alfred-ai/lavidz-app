-- Switch embedding model: OpenAI text-embedding-3-small (1536 dims)
-- → Google gemini-embedding-2-preview with MRL (768 dims)
-- Existing embeddings are incompatible — truncate before altering.

TRUNCATE TABLE "ConversationMemory";

-- Recreate the column with new dimensions
ALTER TABLE "ConversationMemory" DROP COLUMN "embedding";
ALTER TABLE "ConversationMemory" ADD COLUMN "embedding" vector(768);

-- HNSW index for fast cosine similarity search (replaces default IVFFlat)
CREATE INDEX "ConversationMemory_embedding_hnsw_idx"
  ON "ConversationMemory"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
