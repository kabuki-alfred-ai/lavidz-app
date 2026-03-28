import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { Controller, Get, Put, Post, Body, Headers, Query, UseGuards, BadRequestException } from '@nestjs/common'
import { Prisma } from '@lavidz/database'
import type { EntrepreneurProfile } from '@lavidz/database'
import { AdminGuard } from '../../guards/admin.guard'
import { ProfileService } from './services/profile.service'
import { QuestionnaireService } from './services/questionnaire.service'
import { MemoryService, type SearchResult } from './services/memory.service'

type IngestDocumentBody = {
  content: string
  filename?: string
  tags?: string[]
}

// RecursiveCharacterTextSplitter : 512 chars ≈ 120-150 tokens, overlap 10%
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 52,
  separators: ['\n\n', '\n', '. ', '! ', '? ', ' ', ''],
})

async function chunkText(text: string): Promise<string[]> {
  // Normalise les retours ligne PDF (single \n → espace)
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])\n([^\n])/g, '$1 $2')
    .replace(/\n{3,}/g, '\n\n')

  const chunks = await textSplitter.splitText(normalized)
  return chunks.filter((c) => c.trim().length > 40)
}

type GenerateQuestionsBody = {
  goal: string
  organizationId: string
  targetAudience: 'self' | 'client'
  recipientEmail?: string
  recipientName?: string
}

type CreateSessionBody = {
  themeTitle: string
  questions: { text: string; hint?: string; order: number }[]
  targetAudience: 'self' | 'client'
  recipientEmail?: string
  recipientName?: string
  organizationId: string
}

type UpdateProfileBody = {
  organizationId: string
  businessContext?: Prisma.InputJsonValue
  topicsExplored?: string[]
  communicationStyle?: string | null
}

@Controller('ai')
@UseGuards(AdminGuard)
export class AiController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly questionnaireService: QuestionnaireService,
    private readonly memoryService: MemoryService,
  ) {}

  @Get('profile')
  async getProfile(@Headers('x-organization-id') organizationId: string): Promise<EntrepreneurProfile> {
    if (!organizationId) {
      throw new BadRequestException('Header x-organization-id requis')
    }
    return this.profileService.getOrCreate(organizationId)
  }

  @Put('profile')
  async updateProfile(@Body() body: UpdateProfileBody): Promise<EntrepreneurProfile> {
    const { organizationId, ...data } = body
    if (!organizationId) {
      throw new BadRequestException('organizationId requis')
    }
    return this.profileService.update(organizationId, data)
  }

  @Post('generate-questions')
  async generateQuestions(@Body() body: GenerateQuestionsBody): Promise<{
    questions: { text: string; hint?: string; order: number }[]
    themeTitle: string
    themeDescription?: string
    theme: object
    session: object
    shareLink: string
  }> {
    const { goal, organizationId, targetAudience, recipientEmail, recipientName } = body

    if (!goal || !organizationId) {
      throw new BadRequestException('goal et organizationId sont requis')
    }

    const profile = await this.profileService.getOrCreate(organizationId)

    const { questions, themeTitle, themeDescription } = await this.questionnaireService.generateQuestions(
      profile,
      goal,
      [],
    )

    const { theme, session, shareLink } = await this.questionnaireService.createThemeAndSession(
      organizationId,
      questions,
      themeTitle,
      themeDescription,
      {
        email: recipientEmail,
        name: recipientName,
        targetSelf: targetAudience === 'self',
      },
    )

    return { questions, themeTitle, themeDescription, theme, session, shareLink }
  }

  @Post('profile/reset')
  async resetProfile(@Headers('x-organization-id') organizationId: string): Promise<EntrepreneurProfile> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.profileService.reset(organizationId)
  }

  @Post('profile/summarize')
  async summarizeProfile(
    @Headers('x-organization-id') organizationId: string,
  ): Promise<EntrepreneurProfile> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.profileService.generateAndSaveSummary(organizationId)
  }

  @Get('memories')
  async getMemories(
    @Headers('x-organization-id') organizationId: string,
    @Query('limit') limitStr?: string,
  ): Promise<{
    memories: Array<{ id: string; content: string; tags: string[]; sessionId: string | null; createdAt: Date }>
    total: number
    profileId: string
  }> {
    if (!organizationId) {
      throw new BadRequestException('Header x-organization-id requis')
    }
    const profile = await this.profileService.getOrCreate(organizationId)
    const limit = Math.min(50, parseInt(limitStr ?? '20', 10) || 20)
    const [memories, total] = await Promise.all([
      this.memoryService.getRecentForProfile(profile.id, limit),
      this.memoryService.countForProfile(profile.id),
    ])
    return { memories, total, profileId: profile.id }
  }

  @Get('memories/search')
  async searchMemories(
    @Headers('x-organization-id') organizationId: string,
    @Query('q') query: string,
    @Query('k') kStr?: string,
  ): Promise<{ results: SearchResult[] }> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    if (!query?.trim()) return { results: [] }
    const profile = await this.profileService.getOrCreate(organizationId)
    const k = Math.min(10, parseInt(kStr ?? '5', 10) || 5)
    const results = await this.memoryService.search({ profileId: profile.id, query, k })
    return { results }
  }

  @Post('ingest-document')
  async ingestDocument(
    @Headers('x-organization-id') organizationId: string,
    @Body() body: IngestDocumentBody,
  ): Promise<{ saved: number }> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    const { content, filename, tags = [] } = body
    if (!content?.trim()) throw new BadRequestException('content requis')

    const profile = await this.profileService.getOrCreate(organizationId)
    const chunks = await chunkText(content)
    const docTags = ['document', ...tags, ...(filename ? [filename.replace(/\.[^.]+$/, '')] : [])]

    await this.memoryService.saveManyDocs({
      profileId: profile.id,
      items: chunks.map((chunk) => ({ content: chunk, tags: docTags })),
    })

    return { saved: chunks.length }
  }

  @Post('create-session')
  async createSession(@Body() body: CreateSessionBody): Promise<{
    theme: object
    session: object
    shareLink: string
  }> {
    const { themeTitle, questions, targetAudience, recipientEmail, recipientName, organizationId } = body

    if (!themeTitle || !questions?.length || !organizationId) {
      throw new BadRequestException('themeTitle, questions et organizationId sont requis')
    }

    const { theme, session, shareLink } = await this.questionnaireService.createThemeAndSession(
      organizationId,
      questions,
      themeTitle,
      undefined,
      {
        email: recipientEmail,
        name: recipientName,
        targetSelf: targetAudience === 'self',
      },
    )

    return { theme, session, shareLink }
  }
}
