import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { Controller, Get, Put, Post, Delete, Param, Body, Headers, Query, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common'
import { Prisma, prisma } from '@lavidz/database'
import type { EntrepreneurProfile } from '@lavidz/database'
import { AdminGuard } from '../../guards/admin.guard'
import { ProfileService } from './services/profile.service'
import { QuestionnaireService } from './services/questionnaire.service'
import { MemoryService, type SearchResult } from './services/memory.service'
import { LinkedinService, type LinkedinPreview } from './services/linkedin.service'
import { CalendarService } from './services/calendar.service'
import { UnstuckService } from './services/unstuck.service'
import { WeeklyReviewService } from './services/weekly-review.service'
import { SubjectHookService } from './services/subject-hook.service'
import { SourcesService } from './services/sources.service'
import { TopicFromInsightService } from './services/topic-from-insight.service'
import { NarrativeArcService } from './services/narrative-arc.service'
import { ThesisService } from './services/thesis.service'
import { PreflightService } from './services/preflight.service'

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
    private readonly unstuckService: UnstuckService,
    private readonly weeklyReviewService: WeeklyReviewService,
    private readonly subjectHookService: SubjectHookService,
    private readonly sourcesService: SourcesService,
    private readonly topicFromInsightService: TopicFromInsightService,
    private readonly narrativeArcService: NarrativeArcService,
    private readonly thesisService: ThesisService,
    private readonly preflightService: PreflightService,
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

  @Delete('memories/:id')
  async deleteMemory(
    @Headers('x-organization-id') organizationId: string,
    @Param('id') memoryId: string,
  ): Promise<{ ok: boolean }> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    const profile = await this.profileService.getOrCreate(organizationId)
    await this.memoryService.deleteMemory(profile.id, memoryId)
    return { ok: true }
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

  @Post('editorial-plan/propose')
  async proposeEditorialPlan(
    @Headers('x-organization-id') organizationId: string,
    @Body()
    body: {
      platforms?: string[]
      weeksCount?: number
      videosPerWeek?: number
      intentionSummary?: string
      keepExistingTopics?: boolean
    },
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.calendarService.proposeEditorialPlan({
      organizationId,
      platforms: body.platforms?.length ? body.platforms : ['linkedin'],
      weeksCount: Math.min(body.weeksCount ?? 4, 8),
      videosPerWeek: Math.min(body.videosPerWeek ?? 2, 7),
      intentionSummary: body.intentionSummary,
      keepExistingTopics: body.keepExistingTopics ?? true,
    })
  }

  @Post('unstuck/weekly-moment')
  unstuckWeeklyMoment(@Headers('x-organization-id') organizationId: string) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.unstuckService.exploreWeeklyMoment(organizationId)
  }

  @Post('unstuck/resurrect-seed')
  unstuckResurrectSeed(@Headers('x-organization-id') organizationId: string) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.unstuckService.resurrectSeedTopic(organizationId)
  }

  @Post('unstuck/forgotten-domain')
  unstuckForgottenDomain(@Headers('x-organization-id') organizationId: string) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.unstuckService.proposeForgottenDomain(organizationId)
  }

  @Post('unstuck/industry-news')
  unstuckIndustryNews(@Headers('x-organization-id') organizationId: string) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.unstuckService.reactToIndustryNews(organizationId)
  }

  @Post('weekly-review')
  weeklyReview(@Headers('x-organization-id') organizationId: string) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.weeklyReviewService.generateReview(organizationId)
  }

  @Get('subject-hooks/:topicId')
  getSubjectHooks(
    @Headers('x-organization-id') organizationId: string,
    @Param('topicId') topicId: string,
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.subjectHookService.get(organizationId, topicId)
  }

  @Post('subject-hooks/:topicId/generate')
  generateSubjectHooks(
    @Headers('x-organization-id') organizationId: string,
    @Param('topicId') topicId: string,
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.subjectHookService.generate(organizationId, topicId)
  }

  @Post('subject-hooks/:topicId/chosen')
  setSubjectHookChosen(
    @Headers('x-organization-id') organizationId: string,
    @Param('topicId') topicId: string,
    @Body() body: { chosen: 'native' | 'marketing' | null },
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    if (body.chosen !== null && body.chosen !== 'native' && body.chosen !== 'marketing') {
      throw new BadRequestException("chosen doit être 'native', 'marketing' ou null")
    }
    return this.subjectHookService.setChosen(organizationId, topicId, body.chosen)
  }

  @Get('sources/:topicId')
  getSources(
    @Headers('x-organization-id') organizationId: string,
    @Param('topicId') topicId: string,
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.sourcesService.get(organizationId, topicId)
  }

  @Post('sources/:topicId/fetch')
  fetchSources(
    @Headers('x-organization-id') organizationId: string,
    @Param('topicId') topicId: string,
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.sourcesService.fetchForTopic(organizationId, topicId)
  }

  @Get('narrative-arc')
  narrativeArc(@Headers('x-organization-id') organizationId: string) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.narrativeArcService.generate(organizationId)
  }

  @Get('thesis')
  getThesis(@Headers('x-organization-id') organizationId: string) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.thesisService.get(organizationId)
  }

  @Post('thesis/propose')
  proposeThesis(@Headers('x-organization-id') organizationId: string) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.thesisService.propose(organizationId)
  }

  @Put('thesis')
  saveThesis(
    @Headers('x-organization-id') organizationId: string,
    @Body() body: { statement: string; enemies: string[]; audienceArchetype: string },
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    if (!body.statement?.trim()) throw new BadRequestException('statement requis')
    return this.thesisService.save(organizationId, {
      statement: body.statement,
      enemies: body.enemies ?? [],
      audienceArchetype: body.audienceArchetype ?? '',
    })
  }

  @Delete('thesis')
  async clearThesis(@Headers('x-organization-id') organizationId: string) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    await this.thesisService.clear(organizationId)
    return { ok: true }
  }

  @Post('preflight/:topicId')
  preflight(
    @Headers('x-organization-id') organizationId: string,
    @Param('topicId') topicId: string,
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return this.preflightService.runForTopic(organizationId, topicId)
  }

  @Post('editorial-plan/commit')
  async commitEditorialPlan(
    @Headers('x-organization-id') organizationId: string,
    @Body()
    body: {
      proposals: Array<{
        suggestedDate: string
        format: string
        title: string
        angle: string
        hook: string
        pillar?: string | null
        platforms?: string[]
        topicId?: string | null
      }>
    },
  ) {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    if (!Array.isArray(body?.proposals) || body.proposals.length === 0) {
      throw new BadRequestException('proposals est requis')
    }
    return this.calendarService.commitEditorialPlan({
      organizationId,
      proposals: body.proposals as any,
    })
  }

  // ─── Topics CRUD ──────────────────────────────────────────────────────────

  @Get('topics')
  async listTopics(
    @Headers('x-organization-id') organizationId: string,
  ): Promise<object[]> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    return prisma.topic.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        calendarEntries: { select: { id: true, scheduledDate: true, format: true, status: true } },
        sessions: { select: { id: true, status: true, contentFormat: true, createdAt: true } },
      },
    })
  }

  @Get('topics/:id')
  async getTopic(
    @Headers('x-organization-id') organizationId: string,
    @Param('id') id: string,
  ): Promise<object> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    const topic = await prisma.topic.findFirst({
      where: { id, organizationId },
      include: {
        calendarEntries: { orderBy: { scheduledDate: 'asc' } },
        sessions: { include: { theme: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!topic) throw new NotFoundException('Topic introuvable')
    return topic
  }

  @Post('topics')
  async createTopic(
    @Headers('x-organization-id') organizationId: string,
    @Body() body: { name: string; brief?: string; pillar?: string; sourceThreadId?: string; calendarEntryId?: string },
  ): Promise<object> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    if (!body.name?.trim()) throw new BadRequestException('name requis')

    // Deduplication: check if a non-archived Topic with same name exists
    const existing = await prisma.topic.findFirst({
      where: {
        organizationId,
        name: { equals: body.name.trim(), mode: 'insensitive' },
        status: { not: 'ARCHIVED' },
      },
    })
    if (existing) {
      // Link calendar entry if provided
      if (body.calendarEntryId) {
        await prisma.contentCalendar.update({
          where: { id: body.calendarEntryId },
          data: { topicId: existing.id },
        }).catch(() => {})
      }
      return existing
    }

    const slug = `${body.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Date.now()}`

    const topic = await prisma.topic.create({
      data: {
        organizationId,
        name: body.name.trim(),
        slug,
        brief: body.brief ?? null,
        pillar: body.pillar ?? null,
      },
    })

    // Link calendar entry to this topic
    if (body.calendarEntryId) {
      await prisma.contentCalendar.update({
        where: { id: body.calendarEntryId },
        data: { topicId: topic.id },
      }).catch(() => {})
    }

    // Copy recent relevant messages from source thread to topic thread
    if (body.sourceThreadId) {
      const recentMessages = await prisma.chatMessage.findMany({
        where: { organizationId, threadId: body.sourceThreadId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      if (recentMessages.length > 0) {
        await prisma.chatMessage.createMany({
          data: recentMessages.reverse().map((m) => ({
            organizationId,
            threadId: topic.threadId,
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls ?? undefined,
            toolResults: m.toolResults ?? undefined,
          })),
        })
      }
    }

    return topic
  }

  @Post('topics/from-insight')
  async createTopicFromInsight(
    @Headers('x-organization-id') organizationId: string,
    @Body() body: { insight: string; sourceThreadId?: string | null },
  ): Promise<{ topicId: string; name: string; brief: string }> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    if (!body.insight || body.insight.trim().length < 30) {
      throw new BadRequestException("insight trop court (min 30 caractères)")
    }
    return this.topicFromInsightService.createSeed(organizationId, body.insight, {
      sourceThreadId: body.sourceThreadId ?? null,
    })
  }

  @Put('topics/:id')
  async updateTopic(
    @Headers('x-organization-id') organizationId: string,
    @Param('id') id: string,
    @Body() body: { name?: string; brief?: string; status?: string; pillar?: string },
  ): Promise<object> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    const topic = await prisma.topic.findFirst({ where: { id, organizationId } })
    if (!topic) throw new NotFoundException('Topic introuvable')

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.brief !== undefined) data.brief = body.brief
    if (body.status !== undefined) data.status = body.status
    if (body.pillar !== undefined) data.pillar = body.pillar

    return prisma.topic.update({ where: { id }, data })
  }

  @Delete('topics/:id')
  async archiveTopic(
    @Headers('x-organization-id') organizationId: string,
    @Param('id') id: string,
  ): Promise<object> {
    if (!organizationId) throw new BadRequestException('Header x-organization-id requis')
    const topic = await prisma.topic.findFirst({ where: { id, organizationId } })
    if (!topic) throw new NotFoundException('Topic introuvable')
    return prisma.topic.update({ where: { id }, data: { status: 'ARCHIVED' } })
  }
}
