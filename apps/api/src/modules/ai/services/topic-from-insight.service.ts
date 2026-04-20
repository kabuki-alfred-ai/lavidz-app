import { Injectable, Logger } from '@nestjs/common'
import { generateObject } from 'ai'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'

const InsightExtractionSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(80)
    .describe("Nom du sujet : 3-10 mots, évocateur, pas une question, pas un titre marketing"),
  brief: z
    .string()
    .min(40)
    .describe(
      "Angle initial : 2-4 phrases qui condensent l'intuition — ton, angle, pour qui, pourquoi c'est intéressant maintenant. Tutoiement, langage de l'entrepreneur.",
    ),
  suggestedPillar: z
    .string()
    .nullable()
    .describe("Si l'intuition rentre clairement dans un domaine existant, retourne son nom. Sinon null."),
})

/**
 * Distills a free-form chat insight (assistant or user message) into a seed
 * Topic : a clean name + an initial brief. Used by the "Faire un sujet de ça"
 * CTA in the inspiration chat, so any interesting thought can be captured in
 * one click without breaking flow.
 */
@Injectable()
export class TopicFromInsightService {
  private readonly logger = new Logger(TopicFromInsightService.name)

  async createSeed(
    organizationId: string,
    insight: string,
    opts: { sourceThreadId?: string | null } = {},
  ): Promise<{ topicId: string; name: string; brief: string }> {
    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
      select: { businessContext: true, editorialPillars: true, communicationStyle: true },
    })

    const pillars = profile?.editorialPillars ?? []
    const businessCtx = profile?.businessContext ?? {}

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: InsightExtractionSchema,
      prompt: `Tu es Kabou. L'entrepreneur vient de cliquer "Faire un sujet de ça" sur un bout de conversation. Transforme cette intuition en un Sujet exploitable.

Règles non-négociables :
- Tutoiement. "On"/"nous". Pas de jargon publicitaire ("découvrez", "secret", "méthode ultime").
- Le nom doit être évocateur, pas sensationnaliste. 3-10 mots.
- Le brief capture l'angle : qu'est-ce que l'entrepreneur veut dire, pour qui, et pourquoi ça parle maintenant. 2-4 phrases.
- Si l'intuition n'est pas assez solide, fais un brief volontairement large pour laisser place à l'exploration — pas forcé.
- Vocabulaire Lavidz : Sujet, Angle, Domaine. Jamais Topic/Brief/Pilier.

${profile?.communicationStyle ? `Style de l'entrepreneur : ${profile.communicationStyle}\n` : ''}
${pillars.length > 0 ? `Domaines existants : ${pillars.join(', ')} (si l'intuition rentre clairement dans l'un, renvoie-le dans suggestedPillar ; sinon null).\n` : ''}
Contexte business : ${JSON.stringify(businessCtx).slice(0, 1200)}

## Intuition capturée
"""
${insight.slice(0, 4000)}
"""`,
    })

    const pillar =
      object.suggestedPillar && pillars.some((p) => p.toLowerCase() === object.suggestedPillar!.toLowerCase())
        ? object.suggestedPillar
        : null

    const existing = await prisma.topic.findFirst({
      where: {
        organizationId,
        name: { equals: object.name, mode: 'insensitive' },
        status: { not: 'ARCHIVED' },
      },
      select: { id: true, name: true, brief: true },
    })
    if (existing) {
      return { topicId: existing.id, name: existing.name, brief: existing.brief ?? object.brief }
    }

    const slug = `${object.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Date.now()}`

    const topic = await prisma.topic.create({
      data: {
        organizationId,
        name: object.name,
        slug,
        brief: object.brief,
        pillar,
      },
      select: { id: true, name: true, brief: true },
    })

    if (opts.sourceThreadId) {
      this.logger.debug(`Topic ${topic.id} seeded from thread ${opts.sourceThreadId}`)
    }

    return { topicId: topic.id, name: topic.name, brief: topic.brief ?? object.brief }
  }
}
