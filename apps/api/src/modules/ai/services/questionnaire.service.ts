import { Injectable } from '@nestjs/common'
import { generateObject } from 'ai'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import type { EntrepreneurProfile, Theme, Session } from '@lavidz/database'
import { ProfileService } from './profile.service'
import { MemoryService } from './memory.service'
import { buildGenerateQuestionsPrompt } from '../prompts/generate-questions.prompt'
import { getDefaultModel } from '../providers/model.config'

const GeneratedQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        text: z.string(),
        hint: z.string().optional(),
        order: z.number(),
      }),
    )
    .min(3)
    .max(7),
  themeTitle: z.string(),
  themeDescription: z.string().optional(),
})

export type GeneratedQuestion = {
  text: string
  hint?: string
  order: number
}

export type GeneratedQuestionsResult = {
  questions: GeneratedQuestion[]
  themeTitle: string
  themeDescription?: string
}

@Injectable()
export class QuestionnaireService {
  constructor(
    private readonly profileService: ProfileService,
    private readonly memoryService: MemoryService,
  ) {}

  async generateQuestions(
    profile: EntrepreneurProfile,
    goal: string,
    _memories: string[],
  ): Promise<GeneratedQuestionsResult> {
    const searchResults = await this.memoryService.search({
      profileId: profile.id,
      query: goal,
      k: 5,
    })

    const memories = searchResults.map((m) => m.content)

    const prompt = buildGenerateQuestionsPrompt({
      businessContext: profile.businessContext as object,
      topicsExplored: profile.topicsExplored,
      goal,
      memories,
    })

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: GeneratedQuestionsSchema,
      prompt,
    })

    return object
  }

  async createThemeAndSession(
    organizationId: string,
    questions: GeneratedQuestion[],
    themeTitle: string,
    themeDescription: string | undefined,
    recipientInfo: {
      email?: string
      name?: string
      targetSelf: boolean
    },
  ): Promise<{ theme: Theme; session: Session; shareLink: string }> {
    const slug = `${themeTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Date.now()}`

    const theme = await prisma.theme.create({
      data: {
        name: themeTitle,
        slug,
        description: themeDescription ?? null,
        organizationId,
        questions: {
          create: questions.map((q) => ({
            text: q.text,
            hint: q.hint ?? null,
            order: q.order,
          })),
        },
      },
    })

    const session = await prisma.session.create({
      data: {
        themeId: theme.id,
        recipientEmail: recipientInfo.targetSelf ? null : (recipientInfo.email ?? null),
        recipientName: recipientInfo.targetSelf ? null : (recipientInfo.name ?? null),
      },
    })

    const baseUrl = process.env.WEB_URL ?? 'http://localhost:3000'
    const shareLink = `${baseUrl}/s/${session.id}`

    return { theme, session, shareLink }
  }
}
