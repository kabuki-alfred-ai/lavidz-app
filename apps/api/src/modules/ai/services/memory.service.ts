import { Injectable, Logger } from '@nestjs/common'
import { embed, embedMany } from 'ai'
import { prisma } from '@lavidz/database'
import { getEmbedModel, EMBED_DIMENSIONS } from '../providers/model.config'

// F11 — feature flag + timeout pour les enrichissements RAG "voix".
// `RAG_ENRICH_ENABLED=false` = cut d'urgence (les services voix continuent sans RAG).
// Timeout hard 800ms pour éviter de bloquer une génération LLM sur un retrieval lent.
const RAG_ENRICH_ENABLED = process.env.RAG_ENRICH_ENABLED !== 'false'
const RAG_TIMEOUT_MS = Number(process.env.RAG_TIMEOUT_MS ?? 800)

const GOOGLE_EMBED_OPTIONS = {
  google: {
    outputDimensionality: EMBED_DIMENSIONS,
  },
}
const PROVIDER_INDEX = { providerOptions: { ...GOOGLE_EMBED_OPTIONS, google: { ...GOOGLE_EMBED_OPTIONS.google, taskType: 'RETRIEVAL_DOCUMENT' } } }
const PROVIDER_QUERY = { providerOptions: { ...GOOGLE_EMBED_OPTIONS, google: { ...GOOGLE_EMBED_OPTIONS.google, taskType: 'RETRIEVAL_QUERY' } } }

type SaveMemoryParams = {
  profileId: string
  sessionId?: string
  topicId?: string
  content: string
  tags?: string[]
}

type SearchParams = {
  profileId: string
  query: string
  k?: number
  topicId?: string
}

export type SearchResult = {
  content: string
  tags: string[]
  similarity: number
  createdAt: Date
}

type SaveManyParams = {
  profileId: string
  sessionId: string
  topicId?: string
  items: Array<{ content: string; tags: string[] }>
}

type SaveManyDocsParams = {
  profileId: string
  topicId?: string
  items: Array<{ content: string; tags: string[] }>
}

type RawMemoryRow = {
  id: string
  content: string
  tags: string[]
  similarity: number
  createdAt: Date
}

function generateCuid(): string {
  return `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name)

  /**
   * F11 — retrieval enrichissement avec feature flag + timeout + fallback silencieux.
   * À utiliser par les services "voix" (hooks, narrative-arc, reshape script) qui
   * ne doivent jamais bloquer la génération LLM principale sur un souci RAG.
   * Retourne `[]` si désactivé, timeout dépassé ou erreur — jamais de throw.
   * Log structuré pour tracker coût/latence sur chaque call.
   */
  async searchWithFallback(
    params: SearchParams,
    context: { service: string },
  ): Promise<SearchResult[]> {
    if (!RAG_ENRICH_ENABLED) {
      this.logger.debug(
        `[RAG ${context.service}] disabled (RAG_ENRICH_ENABLED=false)`,
      )
      return []
    }
    const started = Date.now()
    try {
      const results = await Promise.race([
        this.search(params),
        new Promise<SearchResult[]>((_, reject) =>
          setTimeout(() => reject(new Error('RAG_TIMEOUT')), RAG_TIMEOUT_MS),
        ),
      ])
      const duration = Date.now() - started
      this.logger.log(
        `[RAG ${context.service}] ok service=${context.service} duration_ms=${duration} hits=${results.length} topic_scoped=${params.topicId ? 'yes' : 'no'}`,
      )
      return results
    } catch (err) {
      const duration = Date.now() - started
      const isTimeout = err instanceof Error && err.message === 'RAG_TIMEOUT'
      this.logger.warn(
        `[RAG ${context.service}] ${isTimeout ? 'timeout' : 'error'} service=${context.service} duration_ms=${duration} err=${String(err)}`,
      )
      return []
    }
  }

  async saveMemory(params: SaveMemoryParams): Promise<{ id: string; content: string }> {
    const { profileId, sessionId, topicId, content, tags = [] } = params

    const { embedding } = await embed({
      model: getEmbedModel(),
      value: content,
      ...PROVIDER_INDEX,
    })

    const vectorLiteral = `[${embedding.join(',')}]`
    const id = generateCuid()
    const now = new Date()
    const tagsLiteral = `{${tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`

    await prisma.$executeRaw`
      INSERT INTO "ConversationMemory" (id, "profileId", "sessionId", "topicId", content, embedding, tags, "createdAt")
      VALUES (${id}, ${profileId}, ${sessionId ?? null}, ${topicId ?? null}, ${content}, ${vectorLiteral}::vector, ${tagsLiteral}::text[], ${now})
    `

    return { id, content }
  }

  async search(params: SearchParams): Promise<SearchResult[]> {
    const { profileId, query, k = 5, topicId } = params

    const { embedding } = await embed({
      model: getEmbedModel(),
      value: query,
      ...PROVIDER_QUERY,
    })

    const vectorLiteral = `[${embedding.join(',')}]`

    const rows = topicId
      ? await prisma.$queryRaw<RawMemoryRow[]>`
          SELECT
            id, content, tags, "createdAt",
            (1 - (embedding <=> ${vectorLiteral}::vector)) AS similarity
          FROM "ConversationMemory"
          WHERE "profileId" = ${profileId} AND "topicId" = ${topicId}
          ORDER BY similarity DESC
          LIMIT ${k}
        `
      : await prisma.$queryRaw<RawMemoryRow[]>`
          SELECT
            id, content, tags, "createdAt",
            (1 - (embedding <=> ${vectorLiteral}::vector)) AS similarity
          FROM "ConversationMemory"
          WHERE "profileId" = ${profileId}
          ORDER BY similarity DESC
          LIMIT ${k}
        `

    return rows.map((row) => ({
      content: row.content,
      tags: row.tags,
      similarity: Number(row.similarity),
      createdAt: row.createdAt,
    }))
  }

  async getRecentForProfile(
    profileId: string,
    limit = 20,
  ): Promise<Array<{ id: string; content: string; tags: string[]; sessionId: string | null; createdAt: Date }>> {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; content: string; tags: string[]; sessionId: string | null; createdAt: Date }>
    >`
      SELECT id, content, tags, "sessionId", "createdAt"
      FROM "ConversationMemory"
      WHERE "profileId" = ${profileId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `
    return rows
  }

  async countForProfile(profileId: string): Promise<number> {
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "ConversationMemory" WHERE "profileId" = ${profileId}
    `
    return Number(result[0].count)
  }

  async deleteMemory(profileId: string, memoryId: string): Promise<void> {
    await prisma.$executeRaw`
      DELETE FROM "ConversationMemory"
      WHERE id = ${memoryId} AND "profileId" = ${profileId}
    `
  }

  async saveManyDocs(params: SaveManyDocsParams): Promise<void> {
    const { profileId, topicId, items } = params
    if (items.length === 0) return

    const { embeddings } = await embedMany({
      model: getEmbedModel(),
      values: items.map((item) => item.content),
      ...PROVIDER_INDEX,
    })

    const now = new Date()
    await Promise.all(
      items.map(async (item, i) => {
        const embedding = embeddings[i]
        const vectorLiteral = `[${embedding.join(',')}]`
        const id = generateCuid()
        const tagsLiteral = `{${item.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`
        await prisma.$executeRaw`
          INSERT INTO "ConversationMemory" (id, "profileId", "sessionId", "topicId", content, embedding, tags, "createdAt")
          VALUES (${id}, ${profileId}, NULL, ${topicId ?? null}, ${item.content}, ${vectorLiteral}::vector, ${tagsLiteral}::text[], ${now})
        `
      })
    )
  }

  async saveMany(params: SaveManyParams): Promise<void> {
    const { profileId, sessionId, topicId, items } = params

    if (items.length === 0) return

    const { embeddings } = await embedMany({
      model: getEmbedModel(),
      values: items.map((item) => item.content),
      ...PROVIDER_INDEX,
    })

    const now = new Date()
    await Promise.all(
      items.map(async (item, i) => {
        const embedding = embeddings[i]
        const vectorLiteral = `[${embedding.join(',')}]`
        const id = generateCuid()
        const tagsLiteral = `{${item.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`
        await prisma.$executeRaw`
          INSERT INTO "ConversationMemory" (id, "profileId", "sessionId", "topicId", content, embedding, tags, "createdAt")
          VALUES (${id}, ${profileId}, ${sessionId}, ${topicId ?? null}, ${item.content}, ${vectorLiteral}::vector, ${tagsLiteral}::text[], ${now})
        `
      })
    )
  }
}
