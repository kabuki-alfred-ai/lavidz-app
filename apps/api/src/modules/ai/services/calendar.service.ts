import { Injectable } from '@nestjs/common'
import { generateObject } from 'ai'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import { ProfileService } from './profile.service'
import { MemoryService } from './memory.service'
import { buildGenerateCalendarPrompt } from '../prompts/generate-calendar.prompt'
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

    // Save entries to database
    const created = await Promise.all(
      object.entries.map((entry) =>
        prisma.contentCalendar.create({
          data: {
            organizationId,
            scheduledDate: new Date(entry.scheduledDate),
            topic: entry.topic,
            description: entry.description,
            format: entry.format as any,
            platforms: entry.platforms,
            aiSuggestions: { hook: entry.hook },
          },
        }),
      ),
    )

    return { generated: created.length, entries: created }
  }
}
