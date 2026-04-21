import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import { Prisma, prisma } from '@lavidz/database'
import { generateObject } from '../providers/ai-sdk'
import { getDefaultModel } from '../providers/model.config'
import { buildReshapeRecordingGuidePrompt } from '../prompts/reshape-recording-guide.prompt'

const SUPPORTED_FORMATS = [
  'MYTH_VS_REALITY',
  'QUESTION_BOX',
  'STORYTELLING',
  'HOT_TAKE',
  'DAILY_TIP',
  'TELEPROMPTER',
] as const
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number]

const FORMAT_TO_KIND: Record<SupportedFormat, string> = {
  MYTH_VS_REALITY: 'myth_vs_reality',
  QUESTION_BOX: 'qa',
  STORYTELLING: 'storytelling',
  HOT_TAKE: 'hot_take',
  DAILY_TIP: 'daily_tip',
  TELEPROMPTER: 'teleprompter',
}

const MythVsRealitySchema = z.object({
  pairs: z
    .array(
      z.object({
        myth: z.string().describe('Idée reçue posée telle que les gens la formulent'),
        reality: z.string().describe('Réalité correctrice, 1-2 phrases tranchantes'),
      }),
    )
    .min(2)
    .max(5),
})

const QASchema = z.object({
  items: z
    .array(
      z.object({
        question: z.string().describe('Question que la cible se pose'),
        keyPoints: z.array(z.string()).min(2).max(4).describe('Points clés pour y répondre'),
      }),
    )
    .min(3)
    .max(5),
})

const StorytellingSchema = z.object({
  beats: z
    .array(
      z.object({
        label: z.enum(['setup', 'tension', 'climax', 'resolution']),
        text: z.string().describe('1-2 phrases décrivant ce beat'),
      }),
    )
    .length(4),
})

const HotTakeSchema = z.object({
  thesis: z.string().describe('Thèse forte en 1 phrase'),
  arguments: z.array(z.string()).min(2).max(4).describe('Arguments qui soutiennent la thèse'),
  punchline: z.string().describe('Phrase finale qui marque les esprits'),
})

const DailyTipSchema = z.object({
  problem: z.string().describe('Problème concret rencontré par la cible'),
  tip: z.string().describe('Conseil actionnable'),
  application: z.string().describe('Comment appliquer dès aujourd\'hui'),
})

const TeleprompterSchema = z.object({
  script: z
    .string()
    .describe(
      'Script structuré en sections [HOOK], [CONTENU], [CTA] avec bullet points concis — PAS un texte à réciter mot pour mot',
    ),
})

/**
 * RecordingGuideService — reformate un draft (bullets) vers la variante
 * adaptée à un contentFormat de session. Ne persiste que si le draft existe.
 * Conserve le draft d'origine dans `sourceDraft` pour permettre un revert.
 */
@Injectable()
export class RecordingGuideService {
  private readonly logger = new Logger(RecordingGuideService.name)

  async reshapeToFormat(
    organizationId: string,
    topicId: string,
    format: string,
  ): Promise<{ recordingGuide: unknown }> {
    if (!SUPPORTED_FORMATS.includes(format as SupportedFormat)) {
      throw new BadRequestException(`format non supporté : ${format}`)
    }
    const typedFormat = format as SupportedFormat

    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { id: true, name: true, brief: true, recordingGuide: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')

    const current = topic.recordingGuide as Record<string, unknown> | null

    // Source des bullets : soit le draft courant, soit le sourceDraft conservé
    // quand on a déjà reshape une fois (re-reshape vers un autre format).
    let bullets: string[] = []
    if (current) {
      if (current.kind === 'draft' && Array.isArray(current.bullets)) {
        bullets = (current.bullets as unknown[]).filter((b): b is string => typeof b === 'string')
      } else if (
        current.sourceDraft &&
        typeof current.sourceDraft === 'object' &&
        Array.isArray((current.sourceDraft as { bullets?: unknown }).bullets)
      ) {
        bullets = ((current.sourceDraft as { bullets: unknown[] }).bullets).filter(
          (b): b is string => typeof b === 'string',
        )
      }
    }

    if (bullets.length < 1) {
      throw new BadRequestException(
        'Aucun fil conducteur draft à reshape — demande d\'abord à Kabou de poser les bullets.',
      )
    }

    const prompt = buildReshapeRecordingGuidePrompt({
      subjectName: topic.name,
      brief: topic.brief,
      draftBullets: bullets,
      format: typedFormat,
    })

    const schema = this.schemaForFormat(typedFormat)
    const { object } = await generateObject({
      model: getDefaultModel(),
      schema,
      prompt,
    })

    const kind = FORMAT_TO_KIND[typedFormat]
    const stored = {
      kind,
      ...object,
      sourceDraft: { bullets },
      updatedAt: new Date().toISOString(),
    }

    await prisma.topic.update({
      where: { id: topic.id },
      data: { recordingGuide: stored as unknown as Prisma.InputJsonValue },
    })

    return { recordingGuide: stored }
  }

  private schemaForFormat(format: SupportedFormat) {
    switch (format) {
      case 'MYTH_VS_REALITY':
        return MythVsRealitySchema
      case 'QUESTION_BOX':
        return QASchema
      case 'STORYTELLING':
        return StorytellingSchema
      case 'HOT_TAKE':
        return HotTakeSchema
      case 'DAILY_TIP':
        return DailyTipSchema
      case 'TELEPROMPTER':
        return TeleprompterSchema
    }
  }
}
