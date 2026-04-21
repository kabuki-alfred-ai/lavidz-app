import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { generateObject } from '../providers/ai-sdk'
import { z } from 'zod'
import { prisma, Prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'
import { buildSubjectHooksPrompt } from '../prompts/generate-subject-hooks.prompt'

const SubjectHooksSchema = z.object({
  native: z.object({
    phrase: z
      .string()
      .describe("Accroche écrite dans la voix native de l'entrepreneur (4-12 mots)"),
    reason: z
      .string()
      .describe("Pourquoi cette formulation colle à son ton (1 phrase factuelle)"),
  }),
  marketing: z.object({
    phrase: z.string().describe('Accroche formatée scroll-stopping (4-12 mots)'),
    reason: z
      .string()
      .describe("Pourquoi cette formulation accroche en 0,5s (1 phrase)"),
  }),
})

export type SubjectHooks = z.infer<typeof SubjectHooksSchema>

export type StoredSubjectHooks = SubjectHooks & {
  chosen?: 'native' | 'marketing' | null
  generatedAt: string
}

/**
 * Generates two contrasted hook proposals for a Sujet — "native" (how the
 * entrepreneur would actually say it, seeded by their voice guide) and
 * "marketing" (scroll-optimized). Non-destructive: writes to Topic.hooks JSON.
 */
@Injectable()
export class SubjectHookService {
  private readonly logger = new Logger(SubjectHookService.name)

  async generate(organizationId: string, topicId: string): Promise<StoredSubjectHooks> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { id: true, name: true, brief: true, pillar: true, hooks: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')

    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
      select: { businessContext: true, communicationStyle: true },
    })

    const businessCtx = (profile?.businessContext ?? {}) as Record<string, unknown>
    const voiceGuide = this.summarizeVoiceGuide(businessCtx.voiceGuide)

    const recentSamples = await this.pickRecentTranscriptSnippets(organizationId, topic.id)

    const prompt = buildSubjectHooksPrompt({
      subjectName: topic.name,
      brief: topic.brief,
      pillar: topic.pillar,
      communicationStyle: profile?.communicationStyle ?? null,
      voiceGuide,
      recentTranscriptSamples: recentSamples,
    })

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: SubjectHooksSchema,
      prompt,
    })

    const stored: StoredSubjectHooks = {
      ...object,
      chosen: this.carryChosen(topic.hooks),
      generatedAt: new Date().toISOString(),
    }

    await prisma.topic.update({
      where: { id: topic.id },
      data: { hooks: stored as unknown as Prisma.InputJsonValue },
    })

    return stored
  }

  async setChosen(
    organizationId: string,
    topicId: string,
    chosen: 'native' | 'marketing' | null,
  ): Promise<StoredSubjectHooks | null> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { hooks: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')
    if (!topic.hooks || typeof topic.hooks !== 'object') {
      return null
    }
    const current = topic.hooks as unknown as StoredSubjectHooks
    const next: StoredSubjectHooks = { ...current, chosen }
    await prisma.topic.update({
      where: { id: topicId },
      data: { hooks: next as unknown as Prisma.InputJsonValue },
    })
    return next
  }

  async get(organizationId: string, topicId: string): Promise<StoredSubjectHooks | null> {
    const topic = await prisma.topic.findFirst({
      where: { id: topicId, organizationId },
      select: { hooks: true },
    })
    if (!topic) throw new NotFoundException('Sujet introuvable')
    if (!topic.hooks || typeof topic.hooks !== 'object') return null
    return topic.hooks as unknown as StoredSubjectHooks
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

  private async pickRecentTranscriptSnippets(
    organizationId: string,
    topicId: string,
  ): Promise<string[]> {
    const sessions = await prisma.session.findMany({
      where: { theme: { organizationId }, topicId },
      orderBy: { submittedAt: 'desc' },
      take: 2,
      select: {
        recordings: {
          select: { transcript: true },
          orderBy: { createdAt: 'asc' },
          take: 2,
        },
      },
    })

    const out: string[] = []
    for (const s of sessions) {
      for (const r of s.recordings) {
        if (r.transcript) {
          const trimmed = r.transcript.replace(/\s+/g, ' ').trim().slice(0, 320)
          if (trimmed.length > 40) out.push(trimmed)
          if (out.length >= 3) return out
        }
      }
    }
    return out
  }
}
