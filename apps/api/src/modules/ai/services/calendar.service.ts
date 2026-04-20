import { Injectable } from '@nestjs/common'
import { generateObject } from 'ai'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import { ProfileService } from './profile.service'
import { MemoryService } from './memory.service'
import { buildGenerateCalendarPrompt } from '../prompts/generate-calendar.prompt'
import { buildProposeEditorialPlanPrompt } from '../prompts/propose-editorial-plan.prompt'
import { getDefaultModel } from '../providers/model.config'

const CalendarEntrySchema = z.object({
  scheduledDate: z.string(),
  topic: z.string(),
  description: z.string(),
  format: z.enum(['QUESTION_BOX', 'TELEPROMPTER', 'HOT_TAKE', 'STORYTELLING', 'DAILY_TIP', 'MYTH_VS_REALITY']),
  platforms: z.array(z.string()),
  hook: z.string(),
})

const GeneratedCalendarSchema = z.object({
  entries: z.array(CalendarEntrySchema).min(1),
})

const EditorialPlanProposalSchema = z.object({
  suggestedDate: z.string(),
  format: z.enum(['QUESTION_BOX', 'TELEPROMPTER', 'HOT_TAKE', 'STORYTELLING', 'DAILY_TIP', 'MYTH_VS_REALITY']),
  title: z.string(),
  angle: z.string(),
  hook: z.string(),
  pillar: z.string().optional().nullable(),
  platforms: z.array(z.string()).default([]),
})

const EditorialPlanSchema = z.object({
  narrativeArc: z.string(),
  intentionCaptured: z.string().optional().default(''),
  proposals: z.array(EditorialPlanProposalSchema).min(1).max(12),
})

export type EditorialPlanProposal = z.infer<typeof EditorialPlanProposalSchema>
export type EditorialPlan = z.infer<typeof EditorialPlanSchema>

@Injectable()
export class CalendarService {
  constructor(
    private readonly profileService: ProfileService,
    private readonly memoryService: MemoryService,
  ) {}

  async generateCalendar(
    organizationId: string,
    platforms: string[],
    weeksCount: number,
    videosPerWeek: number,
  ): Promise<{ generated: number; entries: any[] }> {
    const profile = await this.profileService.getOrCreate(organizationId)

    let memories: string[] = []
    try {
      const searchResults = await this.memoryService.search({
        profileId: profile.id,
        query: 'contenu video personal branding sujets',
        k: 10,
      })
      memories = searchResults.map((m) => m.content)
    } catch {
      // No memories yet — that's fine for first-time users
    }

    const prompt = buildGenerateCalendarPrompt({
      businessContext: profile.businessContext as object,
      topicsExplored: profile.topicsExplored,
      memories,
      platforms,
      weeksCount,
      videosPerWeek,
      communicationStyle: profile.communicationStyle,
    })

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: GeneratedCalendarSchema,
      prompt,
    })

    // Persist each generated entry along with a linked Topic (the Sujet is the
    // atom — ContentCalendar.topicId is now required). We run the inserts
    // sequentially inside a transaction per entry to keep the Topic and its
    // ContentCalendar consistent even if one falls over.
    const created = await Promise.all(
      object.entries.map(async (entry) => {
        const slug = `${entry.topic
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        return prisma.$transaction(async (tx) => {
          const existingTopic = await tx.topic.findFirst({
            where: {
              organizationId,
              name: { equals: entry.topic, mode: 'insensitive' },
              status: { not: 'ARCHIVED' },
            },
          })
          const topic =
            existingTopic ??
            (await tx.topic.create({
              data: {
                organizationId,
                name: entry.topic,
                slug,
                brief: entry.description ?? null,
              },
            }))
          return tx.contentCalendar.create({
            data: {
              organizationId,
              scheduledDate: new Date(entry.scheduledDate),
              description: entry.description,
              format: entry.format as any,
              platforms: entry.platforms,
              aiSuggestions: { hook: entry.hook },
              topicId: topic.id,
            },
          })
        })
      }),
    )

    return { generated: created.length, entries: created }
  }

  /**
   * Propose-step of the dialogued Editorial Vision workflow. Does NOT persist
   * anything — returns a preview the entrepreneur will review, trim and confirm.
   * See project_lavidz_subject_atom_plan.md and the post_recording_analysis
   * memory for the rationale (respectful regeneration, no destructive default).
   */
  async proposeEditorialPlan(params: {
    organizationId: string
    platforms?: string[]
    weeksCount?: number
    videosPerWeek?: number
    intentionSummary?: string
    keepExistingTopics?: boolean
  }): Promise<EditorialPlan> {
    const {
      organizationId,
      platforms = ['linkedin'],
      weeksCount = 4,
      videosPerWeek = 2,
      intentionSummary,
      keepExistingTopics = true,
    } = params

    const profile = await this.profileService.getOrCreate(organizationId)

    let memories: string[] = []
    try {
      const results = await this.memoryService.search({
        profileId: profile.id,
        query: intentionSummary ?? 'vision éditoriale sujets contenus',
        k: 8,
      })
      memories = results.map((m) => m.content)
    } catch {
      // ok — first-time user
    }

    const maturingTopics = keepExistingTopics
      ? await prisma.topic.findMany({
          where: {
            organizationId,
            status: { in: ['DRAFT', 'READY'] },
          },
          select: { id: true, name: true, pillar: true },
          take: 20,
        })
      : []

    const prompt = buildProposeEditorialPlanPrompt({
      businessContext: profile.businessContext as object,
      topicsExplored: profile.topicsExplored,
      memories,
      platforms,
      weeksCount,
      videosPerWeek,
      communicationStyle: profile.communicationStyle,
      intentionSummary: intentionSummary ?? null,
      keepExistingTopics: maturingTopics,
    })

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: EditorialPlanSchema,
      prompt,
    })

    return object
  }

  /**
   * Persist a subset of previously proposed entries. Every committed proposal
   * creates a Topic (state SEED) linked to its ContentCalendar entry, in one
   * transaction per proposal to keep partial failures local.
   */
  async commitEditorialPlan(params: {
    organizationId: string
    proposals: Array<EditorialPlanProposal & { topicId?: string | null }>
  }): Promise<{ committed: number; items: Array<{ topicId: string; calendarEntryId: string }> }> {
    const { organizationId, proposals } = params
    const items: Array<{ topicId: string; calendarEntryId: string }> = []

    for (const p of proposals) {
      const slug = `${p.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

      const result = await prisma.$transaction(async (tx) => {
        // Reuse topic if caller already linked one, otherwise create a fresh SEED.
        let topic
        if (p.topicId) {
          topic = await tx.topic.findFirst({
            where: { id: p.topicId, organizationId },
          })
        }
        if (!topic) {
          topic = await tx.topic.create({
            data: {
              organizationId,
              name: p.title,
              slug,
              brief: p.angle,
              status: 'DRAFT',
              pillar: p.pillar ?? null,
            },
          })
        }

        const entry = await tx.contentCalendar.create({
          data: {
            organizationId,
            scheduledDate: new Date(p.suggestedDate),
            description: p.angle,
            format: p.format,
            platforms: p.platforms ?? [],
            topicId: topic.id,
            aiSuggestions: { hook: p.hook, angle: p.angle },
          },
        })

        return { topicId: topic.id, calendarEntryId: entry.id }
      })

      items.push(result)
    }

    return { committed: items.length, items }
  }
}
