import { Injectable } from '@nestjs/common'
import { embed, embedMany } from 'ai'
import { prisma } from '@lavidz/database'
import { getEmbedModel, EMBED_DIMENSIONS } from '../providers/model.config'

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
  content: string
  tags?: string[]
}

type SearchParams = {
  profileId: string
  query: string
  k?: number
}

export type SearchResult = {
  content: string
  tags: string[]
  similarity: number
}

type SaveManyParams = {
  profileId: string
  sessionId: string
  items: Array<{ content: string; tags: string[] }>
}

type SaveManyDocsParams = {
  profileId: string
  items: Array<{ content: string; tags: string[] }>
}

type RawMemoryRow = {
  id: string
  content: string
  tags: string[]
  similarity: number
}

function generateCuid(): string {
  return `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`
}

@Injectable()
export class MemoryService {
  async saveMemory(params: SaveMemoryParams): Promise<{ id: string; content: string }> {
    const { profileId, sessionId, content, tags = [] } = params

    const { embedding } = await embed({
      model: getEmbedModel(),
      value: content,
      ...PROVIDER_INDEX,
    })

    const vectorLiteral = `[${embedding.join(',')}]`
    const id = generateCuid()
    const now = new Date()
    const tagsLiteral = `{${tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`

    if (sessionId) {
      await prisma.$executeRaw`
        INSERT INTO "ConversationMemory" (id, "profileId", "sessionId", content, embedding, tags, "createdAt")
        VALUES (${id}, ${profileId}, ${sessionId}, ${content}, ${vectorLiteral}::vector, ${tagsLiteral}::text[], ${now})
      `
    } else {
      await prisma.$executeRaw`
        INSERT INTO "ConversationMemory" (id, "profileId", "sessionId", content, embedding, tags, "createdAt")
        VALUES (${id}, ${profileId}, NULL, ${content}, ${vectorLiteral}::vector, ${tagsLiteral}::text[], ${now})
      `
    }

    return { id, content }
  }

  async search(params: SearchParams): Promise<SearchResult[]> {
    const { profileId, query, k = 5 } = params

    const { embedding } = await embed({
      model: getEmbedModel(),
      value: query,
      ...PROVIDER_QUERY,
    })

    const vectorLiteral = `[${embedding.join(',')}]`

    // Hybrid search: 70% semantic (cosine) + 30% keyword (BM25 / tsvector)
    // ts_rank returns 0 when no keyword match → graceful fallback to pure vector
    const rows = await prisma.$queryRaw<RawMemoryRow[]>`
      SELECT
        id, content, tags,
        (
          0.7 * (1 - (embedding <=> ${vectorLiteral}::vector))
          + 0.3 * COALESCE(ts_rank("contentTsv", plainto_tsquery('french', ${query})), 0)
        ) AS similarity
      FROM "ConversationMemory"
      WHERE "profileId" = ${profileId}
        AND embedding IS NOT NULL
      ORDER BY similarity DESC
      LIMIT ${k}
    `

    return rows.map((row) => ({
      content: row.content,
      tags: row.tags,
      similarity: Number(row.similarity),
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

  async saveManyDocs(params: SaveManyDocsParams): Promise<void> {
    const { profileId, items } = params
    if (items.length === 0) return

    const { embeddings } = await embedMany({
      model: getEmbedModel(),
      values: items.map((item) => item.content),
      ...PROVIDER_INDEX,
    })

    const now = new Date()
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const embedding = embeddings[i]
      const vectorLiteral = `[${embedding.join(',')}]`
      const id = generateCuid()
      const tagsLiteral = `{${item.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`

      await prisma.$executeRaw`
        INSERT INTO "ConversationMemory" (id, "profileId", "sessionId", content, embedding, tags, "createdAt")
        VALUES (${id}, ${profileId}, NULL, ${item.content}, ${vectorLiteral}::vector, ${tagsLiteral}::text[], ${now})
      `
    }
  }

  async saveMany(params: SaveManyParams): Promise<void> {
    const { profileId, sessionId, items } = params

    if (items.length === 0) return

    const { embeddings } = await embedMany({
      model: getEmbedModel(),
      values: items.map((item) => item.content),
      ...PROVIDER_INDEX,
    })

    const now = new Date()

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const embedding = embeddings[i]
      const vectorLiteral = `[${embedding.join(',')}]`
      const id = generateCuid()
      const tagsLiteral = `{${item.tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`

      await prisma.$executeRaw`
        INSERT INTO "ConversationMemory" (id, "profileId", "sessionId", content, embedding, tags, "createdAt")
        VALUES (${id}, ${profileId}, ${sessionId}, ${item.content}, ${vectorLiteral}::vector, ${tagsLiteral}::text[], ${now})
      `
    }
  }
}
