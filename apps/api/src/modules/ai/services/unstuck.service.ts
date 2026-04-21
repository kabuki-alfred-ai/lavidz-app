import { Injectable, Logger } from '@nestjs/common'
import { generateObject } from '../providers/ai-sdk'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'
import { ProfileService } from './profile.service'

const SeedPickSchema = z.object({
  picks: z
    .array(
      z.object({
        topicId: z.string(),
        why: z.string().describe('Pourquoi reprendre ce sujet aujourd\'hui (1-2 phrases, chaleureux, tutoiement)'),
        freshAngle: z.string().describe('Un angle frais pour le revisiter avec le contexte actuel'),
      }),
    )
    .min(1)
    .max(3),
})

const ForgottenDomainSchema = z.object({
  domain: z.string(),
  lastSeenWeeksAgo: z.number(),
  angles: z
    .array(
      z.object({
        title: z.string(),
        angle: z.string(),
        format: z.enum(['QUESTION_BOX', 'TELEPROMPTER', 'HOT_TAKE', 'STORYTELLING', 'DAILY_TIP', 'MYTH_VS_REALITY']),
      }),
    )
    .min(2)
    .max(4),
})

const IndustryAngleSchema = z.object({
  articles: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        summary: z.string().describe("Résumé en 2 lignes"),
        reactionAngles: z
          .array(
            z.object({
              angle: z.string(),
              stance: z.enum(['soutenir', 'contester', 'partager_experience']),
            }),
          )
          .min(1)
          .max(3),
      }),
    )
    .min(1)
    .max(3),
})

export type ResurrectSeedResult = z.infer<typeof SeedPickSchema>
export type ForgottenDomainResult = z.infer<typeof ForgottenDomainSchema>
export type IndustryAnglesResult = z.infer<typeof IndustryAngleSchema>

/**
 * Unstuck service — powers the 4 "débloquage créatif" modes wired to Kabou.
 * Each method is callable both from the chat tools and direct REST endpoints,
 * so the UI can offer "I need inspiration" entry points without forcing the
 * entrepreneur to go through a conversation.
 */
@Injectable()
export class UnstuckService {
  private readonly logger = new Logger(UnstuckService.name)

  constructor(private readonly profileService: ProfileService) {}

  /**
   * MODE 1 — "Raconte-moi ta semaine" : returns Kabou-ready conversation
   * openers tailored to the entrepreneur's last 14 days of activity. The
   * actual back-and-forth happens in chat — this method only primes the
   * opener so the LLM can follow up with a concrete topic proposal.
   */
  async exploreWeeklyMoment(organizationId: string): Promise<{
    openers: string[]
    recentCapturedSignals: Array<{ kind: 'topic' | 'session'; label: string; daysAgo: number }>
  }> {
    const sinceDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

    const [recentTopics, recentSessions] = await Promise.all([
      prisma.topic.findMany({
        where: { organizationId, createdAt: { gte: sinceDate } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { name: true, createdAt: true },
      }),
      prisma.session.findMany({
        where: {
          theme: { organizationId },
          submittedAt: { gte: sinceDate },
        },
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: { theme: { select: { name: true } }, submittedAt: true },
      }),
    ])

    const signals = [
      ...recentTopics.map((t) => ({
        kind: 'topic' as const,
        label: t.name,
        daysAgo: Math.floor((Date.now() - t.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
      })),
      ...recentSessions
        .filter((s) => s.submittedAt)
        .map((s) => ({
          kind: 'session' as const,
          label: s.theme?.name ?? 'Tournage',
          daysAgo: Math.floor((Date.now() - (s.submittedAt as Date).getTime()) / (24 * 60 * 60 * 1000)),
        })),
    ].slice(0, 8)

    // Hand-crafted openers that follow the Kabou voice guide (on/nous, pas
    // d'injonction, chaleureux). The LLM can pick one in context.
    const openers = [
      "Raconte-moi — qu'est-ce qui t'a marqué cette semaine dans ton activité ?",
      "Une conversation client ou une discussion qui t'a fait tilter récemment ?",
      'Un petit succès, un échec, ou un détail qui t\'a appris quelque chose ?',
      'Qu\'est-ce qui te travaille en ce moment sans que tu en aies encore parlé ?',
    ]

    return { openers, recentCapturedSignals: signals }
  }

  /**
   * MODE 2 — Resurrect seed topics : pick 2-3 old SEED/ARCHIVED Topics worth
   * revisiting. The LLM picks based on the profile context and proposes a
   * fresh angle for each.
   */
  async resurrectSeedTopic(
    organizationId: string,
  ): Promise<{
    picks: Array<{ topicId: string; name: string; pillar: string | null; why: string; freshAngle: string; brief: string | null }>
  }> {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const candidates = await prisma.topic.findMany({
      where: {
        organizationId,
        status: { in: ['DRAFT', 'ARCHIVED'] },
        updatedAt: { lt: twoWeeksAgo },
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
      select: { id: true, name: true, brief: true, pillar: true, status: true, updatedAt: true },
    })

    if (candidates.length === 0) {
      return { picks: [] }
    }

    const profile = await this.profileService.getOrCreate(organizationId)

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: SeedPickSchema,
      prompt: `Tu es Kabou. L'entrepreneur te dit qu'il n'a plus d'idée. Tu retournes voir ses sujets laissés en Graine ou en Archive pour lui en proposer 2 ou 3 qui méritent d'être repris aujourd'hui.

Règles :
- Tutoiement, "on"/"nous", chaleureux.
- Explique *pourquoi* ce sujet peut encore parler aujourd'hui (un contexte qui a changé, une nouvelle actu, une expertise qui s'est affinée).
- Propose un *angle frais* pour le revisiter — pas juste répéter l'angle initial.

Profil de l'entrepreneur :
${JSON.stringify(profile.businessContext ?? {}, null, 2)}
${profile.editorialPillars.length ? `Domaines : ${profile.editorialPillars.join(', ')}` : ''}

Sujets candidats (les plus récents en tête) :
${candidates
  .map(
    (c) =>
      `- [${c.id}] ${c.name}${c.pillar ? ` (${c.pillar})` : ''} — ${c.status} depuis ${Math.floor((Date.now() - c.updatedAt.getTime()) / (24 * 60 * 60 * 1000))} jours\n  Angle initial : ${c.brief ?? '(vide)'}`,
  )
  .join('\n')}

Retourne 2 ou 3 propositions. Si un seul vaut vraiment la peine, ne te force pas — renvoie juste celui-là.`,
    })

    const byId = new Map(candidates.map((c) => [c.id, c]))
    return {
      picks: object.picks
        .filter((p) => byId.has(p.topicId))
        .map((p) => {
          const c = byId.get(p.topicId)!
          return {
            topicId: c.id,
            name: c.name,
            pillar: c.pillar,
            brief: c.brief,
            why: p.why,
            freshAngle: p.freshAngle,
          }
        }),
    }
  }

  /**
   * MODE 3 — Forgotten domain : detect an editorialPillar that hasn't been
   * covered in the past 21 days and propose 2-3 angles to revive it.
   */
  async proposeForgottenDomain(
    organizationId: string,
  ): Promise<{
    domain: string | null
    lastSeenWeeksAgo: number | null
    angles: Array<{ title: string; angle: string; format: string }>
  }> {
    const profile = await this.profileService.getOrCreate(organizationId)
    const pillars = profile.editorialPillars ?? []
    if (pillars.length === 0) {
      return { domain: null, lastSeenWeeksAgo: null, angles: [] }
    }

    const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
    const recentTopics = await prisma.topic.findMany({
      where: { organizationId, createdAt: { gte: twentyOneDaysAgo } },
      select: { pillar: true },
    })
    const seenPillars = new Set(
      recentTopics.map((t) => t.pillar?.toLowerCase()).filter((p): p is string => !!p),
    )

    const forgotten = pillars.find((p) => !seenPillars.has(p.toLowerCase()))
    if (!forgotten) {
      return { domain: null, lastSeenWeeksAgo: null, angles: [] }
    }

    // Find when it was last seen
    const lastWithPillar = await prisma.topic.findFirst({
      where: { organizationId, pillar: forgotten },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    const lastSeenWeeksAgo = lastWithPillar
      ? Math.floor((Date.now() - lastWithPillar.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 999

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: ForgottenDomainSchema,
      prompt: `Tu es Kabou. L'entrepreneur n'a plus parlé du domaine "${forgotten}" depuis ${lastSeenWeeksAgo} semaines. Propose 2 à 3 angles originaux pour le revisiter.

Règles :
- Tutoiement, chaleureux, "on"/"nous".
- Chaque angle doit être spécifique et défendable — pas "parler de X en général".
- Varie les formats (HOT_TAKE, STORYTELLING, DAILY_TIP, etc.).
- Appuie-toi sur le contexte business ci-dessous.

Profil :
${JSON.stringify(profile.businessContext ?? {}, null, 2)}
${profile.communicationStyle ? `Style : ${profile.communicationStyle}` : ''}

Domaine à revisiter : "${forgotten}"

Retourne domain="${forgotten}", lastSeenWeeksAgo=${lastSeenWeeksAgo}, et un tableau d'angles avec title + angle + format.`,
    })

    return {
      domain: object.domain,
      lastSeenWeeksAgo: object.lastSeenWeeksAgo,
      angles: object.angles,
    }
  }

  /**
   * MODE 4 — React to industry news : web-search the entrepreneur's
   * business keywords (last 7 days), propose 2-3 reaction angles per result.
   *
   * Requires TAVILY_API_KEY. Returns empty results gracefully if absent.
   */
  async reactToIndustryNews(
    organizationId: string,
  ): Promise<{ articles: IndustryAnglesResult['articles']; keyword: string }> {
    const tavilyKey = process.env.TAVILY_API_KEY ?? ''
    if (!tavilyKey) {
      return { articles: [], keyword: '' }
    }

    const profile = await this.profileService.getOrCreate(organizationId)
    const ctx = profile.businessContext as Record<string, unknown>
    const summary = ctx?.summary as Record<string, unknown> | undefined
    const activite = (summary?.activite as string | undefined) ?? null
    const pillars = profile.editorialPillars ?? []

    // Build a keyword — prefer a pillar, else the activité.
    const keyword = pillars[0] ?? activite ?? 'entrepreneuriat'

    // Query Tavily for last-week news.
    let rawResults: Array<{ title: string; url: string; content: string }> = []
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${tavilyKey}`,
        },
        body: JSON.stringify({
          query: keyword,
          search_depth: 'basic',
          topic: 'news',
          days: 7,
          max_results: 5,
          include_answer: false,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { results?: Array<{ title: string; url: string; content: string }> }
        rawResults = (data.results ?? []).map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        }))
      }
    } catch (err) {
      this.logger.warn(`Tavily error during reactToIndustryNews: ${String(err)}`)
    }

    if (rawResults.length === 0) return { articles: [], keyword }

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: IndustryAngleSchema,
      prompt: `Tu es Kabou. L'entrepreneur veut réagir à l'actualité récente de son secteur.

Profil :
${JSON.stringify(profile.businessContext ?? {}, null, 2)}
Domaine principal : ${keyword}

Articles trouvés (7 derniers jours) :
${rawResults
  .slice(0, 5)
  .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content.slice(0, 400)}`)
  .join('\n\n')}

Pour chaque article pertinent (maximum 3), propose :
- un résumé de 2 lignes
- 1 à 3 angles de réaction possibles : soit "soutenir", soit "contester", soit "partager_experience"

Règles : tutoiement, chaleureux, spécifique à l'entrepreneur.`,
    })

    return { articles: object.articles, keyword }
  }
}
