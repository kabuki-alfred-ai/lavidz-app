import { Injectable, Logger } from '@nestjs/common'
import { generateObject } from 'ai'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'

const NarrativeObservationsSchema = z.object({
  headline: z
    .string()
    .describe("Une phrase qui caractérise l'arche éditoriale des 3 derniers mois (tutoiement, chaleureux)"),
  recurringThemes: z
    .array(z.string())
    .max(4)
    .describe("Thématiques transverses qui reviennent à travers les sujets — pas juste des titres de sujets"),
  unexploredAngles: z
    .array(z.string())
    .max(3)
    .describe("Angles ou facettes peu ou pas couverts sur la période, ancrés sur le profil de l'entrepreneur"),
  evolutionMarkers: z
    .array(z.string())
    .max(3)
    .describe("Marqueurs d'évolution observés : affirmation d'un ton, nouveaux formats tentés, approfondissement d'un domaine"),
  coherence: z
    .enum(['dispersé', 'cohérent', 'en train de s’affirmer', 'ciblé'])
    .describe("Qualitatif : comment se lit la trajectoire sur 3 mois"),
})

export type NarrativeObservations = z.infer<typeof NarrativeObservationsSchema>

export type NarrativeArcStats = {
  windowDays: number
  since: string
  until: string
  topicsTotal: number
  sessionsTotal: number
  publishedTotal: number
  activeWeeks: number
  pillarsVolume: Array<{ pillar: string; count: number }>
  formatsVolume: Array<{ format: string; count: number }>
  weeklyTimeline: Array<{ weekStart: string; tournages: number }>
}

export type NarrativeArcResult = {
  stats: NarrativeArcStats
  observations: NarrativeObservations | null
  empty: boolean
}

const WINDOW_DAYS = 90

/**
 * NarrativeArcService — builds a rolling 3-month picture of the entrepreneur's
 * editorial trajectory : volume breakdowns + an LLM-generated set of
 * observations (headline, recurring themes, unexplored angles, evolution
 * markers). Surfaced as a standalone dashboard to let the entrepreneur step
 * back and read their own arc.
 */
@Injectable()
export class NarrativeArcService {
  private readonly logger = new Logger(NarrativeArcService.name)

  async generate(organizationId: string): Promise<NarrativeArcResult> {
    const now = new Date()
    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const [topics, sessions, profile] = await Promise.all([
      prisma.topic.findMany({
        where: { organizationId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          brief: true,
          pillar: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.session.findMany({
        where: {
          theme: { organizationId },
          OR: [
            { submittedAt: { gte: since } },
            { createdAt: { gte: since } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          contentFormat: true,
          submittedAt: true,
          createdAt: true,
          topicEntity: { select: { name: true, pillar: true } },
        },
      }),
      prisma.entrepreneurProfile.findUnique({
        where: { organizationId },
        select: {
          businessContext: true,
          communicationStyle: true,
          editorialPillars: true,
        },
      }),
    ])

    const stats = this.buildStats(topics, sessions, since, now)

    if (topics.length === 0 && sessions.length === 0) {
      return { stats, observations: null, empty: true }
    }

    const observations = await this.buildObservations(stats, topics, sessions, profile)
    return { stats, observations, empty: false }
  }

  private buildStats(
    topics: Array<{ pillar: string | null; createdAt: Date; status: string }>,
    sessions: Array<{
      status: string
      contentFormat: string | null
      submittedAt: Date | null
      createdAt: Date
      topicEntity: { name: string; pillar: string | null } | null
    }>,
    since: Date,
    until: Date,
  ): NarrativeArcStats {
    const pillarsMap = new Map<string, number>()
    for (const t of topics) {
      const key = t.pillar?.trim() || '— sans domaine —'
      pillarsMap.set(key, (pillarsMap.get(key) ?? 0) + 1)
    }
    for (const s of sessions) {
      const key = s.topicEntity?.pillar?.trim() || null
      if (key) {
        // Sessions contribute too, so a pillar fed by tournages also shines even if Topic is older.
        pillarsMap.set(key, (pillarsMap.get(key) ?? 0) + 0.5)
      }
    }
    const pillarsVolume = Array.from(pillarsMap.entries())
      .map(([pillar, count]) => ({ pillar, count: Math.round(count) }))
      .sort((a, b) => b.count - a.count)

    const formatsMap = new Map<string, number>()
    for (const s of sessions) {
      if (!s.contentFormat) continue
      formatsMap.set(s.contentFormat, (formatsMap.get(s.contentFormat) ?? 0) + 1)
    }
    const formatsVolume = Array.from(formatsMap.entries())
      .map(([format, count]) => ({ format, count }))
      .sort((a, b) => b.count - a.count)

    const weeks: Array<{ weekStart: string; tournages: number }> = []
    const msInWeek = 7 * 24 * 60 * 60 * 1000
    for (let i = 12; i >= 0; i--) {
      const weekStart = new Date(until.getTime() - i * msInWeek)
      weekStart.setHours(0, 0, 0, 0)
      // Align to monday (approx — not critical for a rolling view)
      const dayOffset = (weekStart.getDay() + 6) % 7
      weekStart.setDate(weekStart.getDate() - dayOffset)
      const weekEnd = new Date(weekStart.getTime() + msInWeek)
      const count = sessions.filter((s) => {
        const d = s.submittedAt ?? s.createdAt
        return d >= weekStart && d < weekEnd
      }).length
      const key = weekStart.toISOString().slice(0, 10)
      if (!weeks.some((w) => w.weekStart === key)) {
        weeks.push({ weekStart: key, tournages: count })
      }
    }
    const weeklyTimeline = weeks.slice(-12)
    const activeWeeks = weeklyTimeline.filter((w) => w.tournages > 0).length

    return {
      windowDays: WINDOW_DAYS,
      since: since.toISOString(),
      until: until.toISOString(),
      topicsTotal: topics.length,
      sessionsTotal: sessions.length,
      publishedTotal: sessions.filter((s) => s.status === 'DONE').length,
      activeWeeks,
      pillarsVolume,
      formatsVolume,
      weeklyTimeline,
    }
  }

  private async buildObservations(
    stats: NarrativeArcStats,
    topics: Array<{ name: string; brief: string | null; pillar: string | null }>,
    sessions: Array<{ contentFormat: string | null; topicEntity: { name: string; pillar: string | null } | null }>,
    profile: {
      businessContext: unknown
      communicationStyle: string | null
      editorialPillars: string[]
    } | null,
  ): Promise<NarrativeObservations | null> {
    try {
      const topicsBlock = topics
        .slice(0, 20)
        .map((t) => `- ${t.name}${t.pillar ? ` (${t.pillar})` : ''}${t.brief ? ` :: ${t.brief.slice(0, 180)}` : ''}`)
        .join('\n')

      const sessionsBlock = sessions
        .slice(0, 20)
        .map(
          (s) =>
            `- ${s.topicEntity?.name ?? '(sans sujet lié)'}${s.contentFormat ? ` [${s.contentFormat}]` : ''}`,
        )
        .join('\n')

      const prompt = `Tu es Kabou. L'entrepreneur veut prendre du recul sur son arche éditoriale des 3 derniers mois. Tu ne juges pas, tu observes. Tutoiement, on/nous, factuel, chaleureux.

## Règles non-négociables
- Pas de note, pas de score chiffré. Le champ "coherence" est une lecture qualitative.
- Chaque élément doit s'ancrer sur les sujets/tournages ci-dessous — pas d'inventions.
- Vocabulaire Lavidz : Sujet, Tournage, Domaine. Jamais Topic/Session/Pilier.
- "unexploredAngles" et "evolutionMarkers" = observations, pas injonctions. Pas de "tu devrais".

## Profil
${profile?.communicationStyle ? `Style de communication : ${profile.communicationStyle}\n` : ''}
Domaines déclarés : ${profile?.editorialPillars?.join(', ') || 'aucun'}
${profile?.businessContext ? `Contexte : ${JSON.stringify(profile.businessContext).slice(0, 600)}` : ''}

## Période observée (${WINDOW_DAYS} jours)
- ${stats.topicsTotal} sujets créés
- ${stats.sessionsTotal} tournages, dont ${stats.publishedTotal} publiés
- ${stats.activeWeeks} semaines actives sur 12

## Volume par domaine
${stats.pillarsVolume.length ? stats.pillarsVolume.slice(0, 6).map((p) => `- ${p.pillar} : ${p.count}`).join('\n') : '(aucun)'}

## Volume par format
${stats.formatsVolume.length ? stats.formatsVolume.map((f) => `- ${f.format} : ${f.count}`).join('\n') : '(aucun)'}

## Sujets récents (max 20)
${topicsBlock || '(aucun)'}

## Tournages récents (max 20)
${sessionsBlock || '(aucun)'}

## Ce que tu produis
Un objet JSON strict :
- headline : 1 phrase qui capte l'arche (ex: "Tu as creusé la croissance B2B en trois angles différents, en t'affirmant progressivement sur les prises de position.")
- recurringThemes : 2-4 thématiques transverses (ex: "la relation long-terme avec les clients", pas juste des titres)
- unexploredAngles : 0-3 angles peu couverts ancrés sur le profil (observation, pas reproche)
- evolutionMarkers : 0-3 marqueurs d'évolution (nouveau format tenté, ton qui s'affirme, approfondissement)
- coherence : "dispersé" | "cohérent" | "en train de s'affirmer" | "ciblé"

Si la période est très calme, reste doux et reconnais-le dans le headline.`

      const { object } = await generateObject({
        model: getDefaultModel(),
        schema: NarrativeObservationsSchema,
        prompt,
      })
      return object
    } catch (err) {
      this.logger.warn(`NarrativeArc observations failed: ${String(err)}`)
      return null
    }
  }
}
