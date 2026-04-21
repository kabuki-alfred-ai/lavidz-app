import { Injectable, Logger } from '@nestjs/common'
import { generateObject } from '../providers/ai-sdk'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'
import { buildExtractMemoryPrompt, type QAPair } from '../prompts/extract-memory.prompt'
import { MemoryService } from './memory.service'

const ExtractMemorySchema = z.object({
  extracts: z.array(
    z.object({
      content: z.string(),
      tags: z.array(z.string()),
      type: z.enum(['fact', 'quote', 'theme']),
    }),
  ),
  mainTopics: z.array(z.string()),
})

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name)

  constructor(private readonly memoryService: MemoryService) {}

  async enrichFromSession(sessionId: string, profileId: string): Promise<void> {
    this.logger.log(`Enrichissement de la session ${sessionId} pour le profil ${profileId}`)

    const recordings = await prisma.recording.findMany({
      where: {
        sessionId,
        transcript: { not: null },
        status: 'DONE',
      },
      include: {
        question: { select: { text: true } },
      },
    })

    const pairs: QAPair[] = recordings
      .filter(
        (r): r is typeof r & { transcript: string; question: { text: string } } =>
          r.transcript !== null &&
          r.question !== null &&
          r.transcript.trim().length > 0,
      )
      .map((r) => ({ question: r.question.text, answer: r.transcript }))

    if (pairs.length === 0) {
      this.logger.warn(`Aucun Q&A disponible pour la session ${sessionId}`)
      return
    }

    const prompt = buildExtractMemoryPrompt(pairs)

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: ExtractMemorySchema,
      prompt,
    })

    const items = object.extracts.map((extract) => ({
      content: extract.content,
      tags: [...extract.tags, extract.type],
    }))

    await this.memoryService.saveMany({
      profileId,
      sessionId,
      items,
    })

    if (object.mainTopics.length > 0) {
      const profile = await prisma.entrepreneurProfile.findUnique({
        where: { id: profileId },
        select: { topicsExplored: true },
      })

      const existingTopics = profile?.topicsExplored ?? []
      const newTopics = object.mainTopics.filter((t) => !existingTopics.includes(t))

      if (newTopics.length > 0) {
        await prisma.entrepreneurProfile.update({
          where: { id: profileId },
          data: {
            topicsExplored: [...existingTopics, ...newTopics],
          },
        })
      }
    }

    this.logger.log(
      `Session ${sessionId} enrichie : ${items.length} souvenirs sauvegardés, ${object.mainTopics.length} topics mis à jour`,
    )
  }
}
