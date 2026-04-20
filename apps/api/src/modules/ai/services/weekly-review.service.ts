import { Injectable, Logger } from '@nestjs/common'
import { generateObject } from 'ai'
import { z } from 'zod'
import { prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'
import { ProfileService } from './profile.service'

const WeeklyReviewSchema = z.object({
  headline: z.string().describe("Une phrase chaleureuse qui introduit la revue (tutoiement, on/nous)"),
  patterns: z
    .array(z.string())
    .max(4)
    .describe("Ce qui est revenu souvent dans les contenus récents — observations factuelles"),
  strengths: z
    .array(z.string())
    .max(3)
    .describe("Ce qui a bien marché — ancré sur des exemples précis"),
  nextInvitations: z
    .array(
      z.object({
        label: z.string().describe("Titre court de l'invitation"),
        why: z.string().describe("Pourquoi ça pourrait être intéressant maintenant"),
        kind: z.enum(['unexplored_format', 'unexplored_domain', 'deepen_pattern', 'break_routine']),
      }),
    )
    .max(3)
    .describe("Pistes proposées pour la suite — opportunités, pas injonctions"),
})

export type WeeklyReviewResult = z.infer<typeof WeeklyReviewSchema> & {
  period: { start: string; end: string }
  tournagesCount: number
  topicsCount: number
}

/**
 * Weekly review — produced on demand. Walks the entrepreneur's last 7 days
 * of activity and returns a kind, actionable debrief. Designed to run in
 * less than 10 seconds so it can be invoked inline via a Kabou tool.
 */
@Injectable()
export class WeeklyReviewService {
  private readonly logger = new Logger(WeeklyReviewService.name)

  constructor(private readonly profileService: ProfileService) {}

  async generateReview(organizationId: string): Promise<WeeklyReviewResult | null> {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [recentTopics, recentSessions] = await Promise.all([
      prisma.topic.findMany({
        where: { organizationId, createdAt: { gte: weekAgo } },
        orderBy: { createdAt: 'desc' },
        select: { name: true, brief: true, pillar: true, status: true },
      }),
      prisma.session.findMany({
        where: {
          theme: { organizationId },
          submittedAt: { gte: weekAgo },
        },
        orderBy: { submittedAt: 'desc' },
        include: {
          theme: { select: { name: true } },
          topicEntity: { select: { name: true, pillar: true } },
          analysis: { select: { summary: true, standoutMoment: true, strengths: true } },
          recordings: { select: { transcript: true } },
        },
      }),
    ])

    if (recentTopics.length === 0 && recentSessions.length === 0) {
      return null
    }

    const profile = await this.profileService.getOrCreate(organizationId)

    const sessionsSummary = recentSessions.map((s) => ({
      name: s.topicEntity?.name ?? s.theme?.name ?? 'Tournage',
      pillar: s.topicEntity?.pillar ?? null,
      analysisSummary: Array.isArray(s.analysis?.summary)
        ? (s.analysis.summary as string[]).slice(0, 3)
        : [],
      standout: s.analysis?.standoutMoment ?? null,
      wordsCount: s.recordings.reduce(
        (sum, r) => sum + (r.transcript?.split(/\s+/).filter(Boolean).length ?? 0),
        0,
      ),
    }))

    const prompt = `Tu es Kabou, compagnon créatif. Tu restitues une revue hebdomadaire à l'entrepreneur, dans ton ton habituel (tutoiement, on/nous, chaleureux, pas de jugement).

## Règles non-négociables
- Pas de note, pas de score. Pas de "défaut" — utilise "piste" ou "invitation".
- Tout doit être factuel : chaque pattern ou force doit s'ancrer sur un contenu réel ci-dessous.
- Si la semaine est calme (peu de données), dis-le sans culpabiliser : "cette semaine a été calme, on repart plus fort quand tu veux".
- Vocabulaire : Sujet, Angle, Domaine, Tournage. Jamais Topic/Brief/Pilier/Session.

## Profil
${profile.communicationStyle ? `Style habituel : ${profile.communicationStyle}\n` : ''}
Domaines déclarés : ${profile.editorialPillars.join(', ') || 'aucun'}

## Activité de la semaine (${weekAgo.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)})

Tournages (${recentSessions.length}) :
${sessionsSummary
  .map(
    (s, i) =>
      `${i + 1}. ${s.name}${s.pillar ? ` (domaine: ${s.pillar})` : ''}\n   Résumé: ${s.analysisSummary.join(' / ') || '(pas encore analysé)'}\n   ${s.standout ? `Moment fort: "${s.standout}"` : ''}\n   Longueur: ${s.wordsCount} mots`,
  )
  .join('\n\n')}

Sujets créés (${recentTopics.length}) :
${recentTopics.map((t) => `- ${t.name}${t.pillar ? ` (${t.pillar})` : ''} — ${t.status}`).join('\n')}

## Ce que tu produis

Un objet JSON strict :
- headline : 1 phrase d'ouverture chaleureuse (max 20 mots)
- patterns : 2-4 observations factuelles sur ce qui revient (sujets traités, format dominant, rythme, lexique)
- strengths : 1-3 forces concrètes observées (ancrées sur un tournage précis)
- nextInvitations : 1-3 invitations pour la suite, formulées comme opportunités — chaque invitation a un "kind" parmi :
  - unexplored_format : "tu n'as pas essayé [format] — voici pourquoi ça pourrait te convenir"
  - unexplored_domain : "tu n'as pas parlé de [domaine] récemment"
  - deepen_pattern : "un thème revient sans que tu l'approfondisses — on pourrait creuser"
  - break_routine : "tu répètes un schéma — une rupture ferait du bien"

Si la semaine est très calme (1 tournage ou moins), limite-toi à 1 pattern + 1 invitation, avec headline doux.`

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: WeeklyReviewSchema,
      prompt,
    })

    return {
      ...object,
      period: { start: weekAgo.toISOString(), end: now.toISOString() },
      tournagesCount: recentSessions.length,
      topicsCount: recentTopics.length,
    }
  }
}
