import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { generateObject } from '../providers/ai-sdk'
import { z } from 'zod'
import { prisma, Prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'
import { buildSubjectHooksPrompt } from '../prompts/generate-subject-hooks.prompt'
import { MemoryService } from './memory.service'
import { formatTopicSourcesForPrompt } from './sources-context.util'

const SessionHooksSchema = z.object({
  native: z.object({
    phrase: z
      .string()
      .describe("Accroche écrite dans la voix native de l'entrepreneur (4-12 mots)"),
    reason: z.string().describe("Pourquoi cette formulation colle à son ton (1 phrase factuelle)"),
  }),
  marketing: z.object({
    phrase: z.string().describe('Accroche formatée scroll-stopping (4-12 mots)'),
    reason: z.string().describe("Pourquoi cette formulation accroche en 0,5s (1 phrase)"),
  }),
})

export type SessionHooks = z.infer<typeof SessionHooksSchema>

export type StoredSessionHooks = SessionHooks & {
  chosen?: 'native' | 'marketing' | null
  generatedAt: string
  contentFormat: string
}

/**
 * SessionHookService — génération d'accroches FORMAT-SPECIFIC stockées sur
 * `Session.hooks`. Contrairement à `SubjectHookService` (qui écrivait sur
 * `Topic.hooks` sans format), ce service tient compte du `contentFormat`
 * de la session + de `Topic.narrativeAnchor` + de la mémoire RAG scopée
 * au Topic pour ancrer la voix de l'entrepreneur.
 *
 * Les hooks générés ici vivent le temps d'UN tournage (une session). Pour
 * des notes libres long-terme, voir `TopicHookDraftService`.
 */
@Injectable()
export class SessionHookService {
  private readonly logger = new Logger(SessionHookService.name)

  constructor(private readonly memoryService: MemoryService) {}

  async generate(organizationId: string, sessionId: string): Promise<StoredSessionHooks> {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, theme: { organizationId } },
      select: {
        id: true,
        contentFormat: true,
        hooks: true,
        topicId: true,
        topicEntity: {
          select: {
            id: true,
            name: true,
            brief: true,
            pillar: true,
            narrativeAnchor: true,
            hookDraft: true,
            sources: true,
          },
        },
      },
    })
    if (!session) throw new NotFoundException('Session introuvable')
    if (!session.contentFormat) {
      throw new BadRequestException('Session sans contentFormat — impossible de générer des hooks')
    }
    if (!session.topicEntity) {
      throw new BadRequestException('Session sans Topic lié — impossible de générer des hooks')
    }

    const topic = session.topicEntity

    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
      select: { id: true, businessContext: true, communicationStyle: true },
    })

    const businessCtx = (profile?.businessContext ?? {}) as Record<string, unknown>
    const voiceGuide = this.summarizeVoiceGuide(businessCtx.voiceGuide)

    // RAG topic-scoped — injecte les tournures passées de l'entrepreneur sur ce sujet
    // via le wrapper avec timeout/flag (F11). Cross-session : on cherche les memories
    // précédentes liées au Topic.
    const ragHits = profile
      ? await this.memoryService.searchWithFallback(
          {
            profileId: profile.id,
            topicId: topic.id,
            query: this.buildRagQuery(topic, session.contentFormat),
            k: 5,
          },
          { service: 'session-hook' },
        )
      : []

    const recentSamples = this.extractRecentSamples(ragHits.map((h) => h.content))

    // Sources factuelles — permettent à Kabou d'ancrer une accroche "native"
    // sur un chiffre concret ou une anecdote plutôt que de rester dans
    // l'abstrait. Optionnel : si null, le prompt continue sans.
    const sourcesBlock = formatTopicSourcesForPrompt(topic.sources)

    const prompt = this.buildFormatAwarePrompt({
      subjectName: topic.name,
      brief: this.formatBriefWithAnchor(topic.brief, topic.narrativeAnchor, topic.hookDraft),
      pillar: topic.pillar,
      communicationStyle: profile?.communicationStyle ?? null,
      voiceGuide,
      recentTranscriptSamples: recentSamples,
      contentFormat: session.contentFormat,
      sourcesBlock,
    })

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: SessionHooksSchema,
      prompt,
    })

    const stored: StoredSessionHooks = {
      ...object,
      chosen: this.carryChosen(session.hooks),
      generatedAt: new Date().toISOString(),
      contentFormat: session.contentFormat,
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { hooks: stored as unknown as Prisma.InputJsonValue },
    })

    return stored
  }

  async setChosen(
    organizationId: string,
    sessionId: string,
    chosen: 'native' | 'marketing' | null,
  ): Promise<StoredSessionHooks | null> {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, theme: { organizationId } },
      select: { id: true, hooks: true },
    })
    if (!session) throw new NotFoundException('Session introuvable')
    if (!session.hooks || typeof session.hooks !== 'object') return null
    const current = session.hooks as unknown as StoredSessionHooks
    const next: StoredSessionHooks = { ...current, chosen }
    await prisma.session.update({
      where: { id: sessionId },
      data: { hooks: next as unknown as Prisma.InputJsonValue },
    })
    return next
  }

  async get(organizationId: string, sessionId: string): Promise<StoredSessionHooks | null> {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, theme: { organizationId } },
      select: { hooks: true },
    })
    if (!session) throw new NotFoundException('Session introuvable')
    if (!session.hooks || typeof session.hooks !== 'object') return null
    return session.hooks as unknown as StoredSessionHooks
  }

  private carryChosen(
    existing: Prisma.JsonValue | null | undefined,
  ): 'native' | 'marketing' | null {
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return null
    const chosen = (existing as Record<string, unknown>).chosen
    return chosen === 'native' || chosen === 'marketing' ? chosen : null
  }

  private summarizeVoiceGuide(raw: unknown): string | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const vg = raw as Record<string, unknown>
    const parts: string[] = []
    const push = (label: string, value: unknown) => {
      if (Array.isArray(value) && value.length > 0) {
        parts.push(`${label} : ${value.slice(0, 6).join(', ')}`)
      }
    }
    push('Ouvertures fréquentes', vg.openingPatterns)
    push('Tics de langage', vg.linguisticTics)
    push('Ton', vg.toneMarkers)
    push('Lexique', vg.lexicon)
    if (typeof vg.averageSentenceLength === 'number') {
      parts.push(`Longueur moyenne de phrase : ${Math.round(vg.averageSentenceLength)} mots`)
    }
    return parts.length ? parts.join('\n') : null
  }

  private buildRagQuery(
    topic: { name: string; brief: string | null; narrativeAnchor: unknown },
    contentFormat: string,
  ): string {
    const anchorBullets = this.extractAnchorBullets(topic.narrativeAnchor)
    const pieces = [topic.name, topic.brief ?? '', anchorBullets.join(' '), contentFormat]
      .filter(Boolean)
      .join(' ')
    return pieces.trim() || topic.name
  }

  private extractAnchorBullets(raw: unknown): string[] {
    if (!raw || typeof raw !== 'object') return []
    const r = raw as Record<string, unknown>
    if (r.kind !== 'draft') return []
    return Array.isArray(r.bullets)
      ? (r.bullets as unknown[]).filter((b): b is string => typeof b === 'string')
      : []
  }

  private formatBriefWithAnchor(
    brief: string | null,
    narrativeAnchor: unknown,
    hookDraft: unknown,
  ): string | null {
    const parts: string[] = []
    if (brief?.trim()) parts.push(brief.trim())
    const bullets = this.extractAnchorBullets(narrativeAnchor)
    if (bullets.length > 0) {
      parts.push(`Ancre narrative :\n${bullets.map((b) => `- ${b}`).join('\n')}`)
    }
    if (hookDraft && typeof hookDraft === 'object') {
      const notes = (hookDraft as Record<string, unknown>).notes
      if (typeof notes === 'string' && notes.trim()) {
        parts.push(`Notes d'accroches déjà en tête :\n${notes.trim()}`)
      }
    }
    return parts.length ? parts.join('\n\n') : null
  }

  private extractRecentSamples(memoryContents: string[]): string[] {
    const out: string[] = []
    for (const content of memoryContents) {
      if (!content) continue
      const trimmed = content.replace(/\s+/g, ' ').trim().slice(0, 320)
      if (trimmed.length > 40) out.push(trimmed)
      if (out.length >= 3) break
    }
    return out
  }

  private buildFormatAwarePrompt(ctx: {
    subjectName: string
    brief: string | null
    pillar: string | null
    communicationStyle: string | null
    voiceGuide: string | null
    recentTranscriptSamples: string[]
    contentFormat: string
    sourcesBlock: string | null
  }): string {
    const base = buildSubjectHooksPrompt({
      subjectName: ctx.subjectName,
      brief: ctx.brief,
      pillar: ctx.pillar,
      communicationStyle: ctx.communicationStyle,
      voiceGuide: ctx.voiceGuide,
      recentTranscriptSamples: ctx.recentTranscriptSamples,
      sourcesBlock: ctx.sourcesBlock,
    })
    return `${base}\n\n## Format cible\nContentFormat : ${ctx.contentFormat}\nLes accroches produites doivent matcher le registre du format (ex: HOT_TAKE → thèse contrariante, STORYTELLING → première phrase qui amorce une scène, DAILY_TIP → problème + promesse de solution). Si une source factuelle colle (chiffre, contre-exemple), **privilégie-la** dans l'accroche "native" — c'est ce qui distingue une accroche ancrée d'une accroche générique.`
  }
}
