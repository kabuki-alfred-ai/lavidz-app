import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { Controller, Get, Put, Post, Body, Headers, Query, UseGuards, BadRequestException } from '@nestjs/common'
import { Prisma, prisma } from '@lavidz/database'
import type { EntrepreneurProfile } from '@lavidz/database'
import { AdminGuard } from '../../guards/admin.guard'
import { ProfileService } from './services/profile.service'
import { QuestionnaireService } from './services/questionnaire.service'
import { MemoryService, type SearchResult } from './services/memory.service'
import { LinkedinService, type LinkedinPreview } from './services/linkedin.service'
import { CalendarService } from './services/calendar.service'

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
  format?: string
  platform?: string
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
  linkedinUrl?: string | null
  websiteUrl?: string | null
}

type LinkedinIngestBody = {
  organizationId: string
  linkedinUrl: string
}

@Controller('ai')
@UseGuards(AdminGuard)
export class AiController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly questionnaireService: QuestionnaireService,
    private readonly memoryService: MemoryService,
    private readonly linkedinService: LinkedinService,
    private readonly calendarService: CalendarService,
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
    const { goal, organizationId, targetAudience, recipientEmail, recipientName, format, platform } = body

    if (!goal || !organizationId) {
      throw new BadRequestException('goal et organizationId sont requis')
    }

    const profile = await this.profileService.getOrCreate(organizationId)

    const { questions, themeTitle, themeDescription } = await this.questionnaireService.generateQuestions(
      profile,
      goal,
      [],
      { format, platform },
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
      { format, platform },
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

  @Post('linkedin/ingest')
  async ingestLinkedin(@Body() body: LinkedinIngestBody): Promise<{ saved: number }> {
    const { organizationId, linkedinUrl } = body
    if (!organizationId) throw new BadRequestException('organizationId requis')
    if (!linkedinUrl) throw new BadRequestException('linkedinUrl requis')
    return this.linkedinService.ingestLinkedinData(organizationId, linkedinUrl)
  }

  @Get('linkedin/preview')
  async getLinkedinPreview(@Query('url') url: string): Promise<LinkedinPreview> {
    if (!url) throw new BadRequestException('url requis')
    return this.linkedinService.getPreview(url)
  }

  @Post('website/ingest')
  async ingestWebsite(
    @Body() body: { organizationId: string; websiteUrl: string },
  ): Promise<{ saved: number }> {
    const { organizationId, websiteUrl } = body
    if (!organizationId) throw new BadRequestException('organizationId requis')
    if (!websiteUrl) throw new BadRequestException('websiteUrl requis')

    const tavilyKey = process.env.TAVILY_API_KEY ?? ''
    if (!tavilyKey) throw new BadRequestException('TAVILY_API_KEY non configuree')

    const profile = await this.profileService.getOrCreate(organizationId)

    // Use Tavily extract to crawl the website
    const extractRes = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tavilyKey}`,
      },
      body: JSON.stringify({ urls: [websiteUrl] }),
    })

    let contentToIndex = ''

    if (extractRes.ok) {
      const extractData = await extractRes.json() as { results?: { raw_content?: string; url: string }[] }
      const results = extractData.results ?? []
      contentToIndex = results.map((r) => r.raw_content ?? '').join('\n\n')
    }

    // Fallback: also do a deep search about the site
    const searchRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tavilyKey}`,
      },
      body: JSON.stringify({
        query: `site:${websiteUrl} informations entreprise services produits`,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 10,
        include_raw_content: true,
      }),
    })

    if (searchRes.ok) {
      const searchData = await searchRes.json() as { answer?: string; results?: { content?: string }[] }
      if (searchData.answer) contentToIndex += `\n\n${searchData.answer}`
      for (const r of searchData.results ?? []) {
        if (r.content) contentToIndex += `\n\n${r.content}`
      }
    }

    if (!contentToIndex.trim()) {
      throw new BadRequestException('Aucun contenu recupere depuis ce site')
    }

    // Chunk and index
    const chunks = await chunkText(contentToIndex)
    const docTags = ['website', new URL(websiteUrl).hostname]

    await this.memoryService.saveManyDocs({
      profileId: profile.id,
      items: chunks.map((chunk) => ({ content: chunk, tags: docTags })),
    })

    // Update profile with website info
    await this.profileService.update(organizationId, { websiteUrl })
    await prisma.entrepreneurProfile.update({
      where: { organizationId },
      data: { websiteIngestedAt: new Date() },
    })

    return { saved: chunks.length }
  }

  @Post('generate-calendar')
  async generateCalendar(
    @Headers('x-organization-id') organizationId: string,
    @Body() body: { platforms?: string[]; weeksCount?: number; videosPerWeek?: number },
  ): Promise<{ generated: number; entries: any[] }> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    const platforms = body.platforms?.length ? body.platforms : ['linkedin']
    const weeksCount = Math.min(body.weeksCount ?? 4, 8)
    const videosPerWeek = Math.min(body.videosPerWeek ?? 3, 7)
    return this.calendarService.generateCalendar(organizationId, platforms, weeksCount, videosPerWeek)
  }
}
