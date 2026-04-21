import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { z } from 'zod'
import { Prisma, prisma } from '@lavidz/database'
import { generateObject } from '../providers/ai-sdk'
import { getDefaultModel } from '../providers/model.config'
import { buildReshapeRecordingGuidePrompt } from '../prompts/reshape-recording-guide.prompt'
import { MemoryService } from './memory.service'

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

  constructor(private readonly memoryService: MemoryService) {}

  /**
   * Reshape `Topic.narrativeAnchor` → `Session.recordingScript` format-specific,
   * enrichi RAG topic-scoped pour la cohérence de voix (Task 2.5, F11).
   * Écrit dans `Session.recordingScript` avec `anchorSyncedAt` et
   * `sourceAnchorBullets` (traçabilité vers l'ancre d'origine).
   */
  async reshapeSessionScript(
    organizationId: string,
    sessionId: string,
    format: string,
  ): Promise<{ recordingScript: unknown }> {
    if (!SUPPORTED_FORMATS.includes(format as SupportedFormat)) {
      throw new BadRequestException(`format non supporté : ${format}`)
    }
    const typedFormat = format as SupportedFormat

    const session = await prisma.session.findFirst({
      where: { id: sessionId, theme: { organizationId } },
      select: {
        id: true,
        topicId: true,
        topicEntity: {
          select: {
            id: true,
            name: true,
            brief: true,
            narrativeAnchor: true,
            recordingGuide: true,
          },
        },
      },
    })
    if (!session) throw new NotFoundException('Session introuvable')
    if (!session.topicEntity) {
      throw new BadRequestException('Session sans Topic lié')
    }
    const topic = session.topicEntity

    // Bullets source : priorité narrativeAnchor, fallback recordingGuide legacy
    let bullets: string[] = []
    const anchor = topic.narrativeAnchor as Record<string, unknown> | null
    if (anchor?.kind === 'draft' && Array.isArray(anchor.bullets)) {
      bullets = (anchor.bullets as unknown[]).filter((b): b is string => typeof b === 'string')
    } else {
      const legacy = topic.recordingGuide as Record<string, unknown> | null
      if (legacy?.kind === 'draft' && Array.isArray(legacy.bullets)) {
        bullets = (legacy.bullets as unknown[]).filter((b): b is string => typeof b === 'string')
      } else if (
        legacy?.sourceDraft &&
        typeof legacy.sourceDraft === 'object' &&
        Array.isArray((legacy.sourceDraft as { bullets?: unknown }).bullets)
      ) {
        bullets = ((legacy.sourceDraft as { bullets: unknown[] }).bullets).filter(
          (b): b is string => typeof b === 'string',
        )
      }
    }

    if (bullets.length < 1) {
      throw new BadRequestException(
        "Ce sujet n'a pas d'ancre narrative — demande d'abord à Kabou de poser les bullets.",
      )
    }

    // RAG topic-scoped (F11) — enrichit le prompt avec les tournures passées
    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
      select: { id: true },
    })
    const ragHits = profile
      ? await this.memoryService.searchWithFallback(
          {
            profileId: profile.id,
            topicId: topic.id,
            query: `${bullets.join(' ')} ${typedFormat}`,
            k: 5,
          },
          { service: 'reshape-recording-script' },
        )
      : []

    const basePrompt = buildReshapeRecordingGuidePrompt({
      subjectName: topic.name,
      brief: topic.brief,
      draftBullets: bullets,
      format: typedFormat,
    })
    const voiceBlock = ragHits.length
      ? `\n\n## Tes tournures passées sur ce sujet (mémoire, utilise-les pour coller à la voix native)\n${ragHits
          .slice(0, 5)
          .map((h) => `- ${h.content.replace(/\s+/g, ' ').trim().slice(0, 220)}`)
          .join('\n')}`
      : ''
    const prompt = basePrompt + voiceBlock

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
      anchorSyncedAt: new Date().toISOString(),
      sourceAnchorBullets: bullets,
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { recordingScript: stored as unknown as Prisma.InputJsonValue },
    })

    return { recordingScript: stored }
  }

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
