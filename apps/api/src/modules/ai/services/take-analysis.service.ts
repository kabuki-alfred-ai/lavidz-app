import { Injectable, Logger } from '@nestjs/common'
import { generateObject } from '../providers/ai-sdk'
import { z } from 'zod'
import { prisma, Prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'

const TakeAnalysisSchema = z.object({
  canonicalRecordingId: z.string().describe('ID du Recording sélectionné comme meilleur take'),
  reason: z
    .string()
    .describe(
      "1 phrase qui explique pourquoi c'est le meilleur take de façon spécifique (ton, tempo, clarté)",
    ),
  criteria: z.object({
    tempo: z.number().min(0).max(1),
    clarity: z.number().min(0).max(1),
    energy: z.number().min(0).max(1),
    tone: z.number().min(0).max(1),
  }),
})

export type TakeAnalysisResult = z.infer<typeof TakeAnalysisSchema>

/**
 * TakeAnalysisService — compare les prises multiples d'une même question
 * (sessionId, questionId) et stocke une recommandation sur le Recording
 * canonique. V1 = service backend qui alimente le badge ⭐ du take selector
 * (cf. ProjectDetail, Story 9). V1.5+ pourra surfacer une UI de sélection
 * canonique post-hoc.
 *
 * Non-bloquant : toute erreur LLM est logguée et ignorée côté flow session.
 */
@Injectable()
export class TakeAnalysisService {
  private readonly logger = new Logger(TakeAnalysisService.name)

  async analyzeSessionTakes(sessionId: string): Promise<void> {
    const recordings = await prisma.recording.findMany({
      where: { sessionId, transcript: { not: null } },
      select: {
        id: true,
        questionId: true,
        transcript: true,
        supersededAt: true,
        createdAt: true,
        wordTimestamps: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (recordings.length === 0) return

    // Regroupe par questionId
    const byQuestion = new Map<string, typeof recordings>()
    for (const r of recordings) {
      const list = byQuestion.get(r.questionId) ?? []
      list.push(r)
      byQuestion.set(r.questionId, list)
    }

    // Traite uniquement les groupes avec 2+ recordings (sinon rien à comparer).
    for (const [questionId, group] of byQuestion) {
      if (group.length < 2) continue
      try {
        const result = await this.compareGroup(sessionId, questionId, group)
        if (!result) continue
        // Stocke la reco sur le Recording élu canonical (qu'il soit superseded
        // ou non — l'UI de ProjectDetail décidera quoi en faire).
        await prisma.recording.update({
          where: { id: result.canonicalRecordingId },
          data: {
            kabouRecommendation: {
              score: this.aggregateScore(result.criteria),
              reason: result.reason,
              criteria: result.criteria,
            } as unknown as Prisma.InputJsonValue,
          },
        })
      } catch (err) {
        this.logger.warn(
          `take-analysis group failed (session=${sessionId} question=${questionId}): ${String(err)}`,
        )
      }
    }
  }

  private async compareGroup(
    sessionId: string,
    questionId: string,
    group: Array<{
      id: string
      transcript: string | null
      createdAt: Date
      wordTimestamps: Prisma.JsonValue
    }>,
  ): Promise<TakeAnalysisResult | null> {
    const takesBlock = group
      .map((r, i) => {
        const durationSec = this.extractDuration(r.wordTimestamps)
        const durationLabel = durationSec ? `${durationSec.toFixed(1)}s` : 'durée ?'
        const transcript = (r.transcript ?? '').replace(/\s+/g, ' ').trim().slice(0, 600)
        return `[Prise ${i + 1} — id ${r.id}, ${durationLabel}]\n${transcript}`
      })
      .join('\n\n')

    const prompt = `Tu es Kabou, compagnon éditorial. L'entrepreneur a fait plusieurs prises de la même question dans un même tournage. Compare-les et choisis celle qui mérite d'être canonique (la mettre en avant dans le montage).

## Règles
- Tutoiement, on/nous, chaleureux, spécifique.
- Évalue 4 critères, de 0 à 1 :
  * tempo — rythme, respiration, pas trop lent ni bâclé
  * clarity — articulation, absence de filler, structure des idées
  * energy — engagement, conviction dans la voix
  * tone — cohérence tonale avec le reste du contenu, naturel
- reason : 1 phrase SPÉCIFIQUE (pas générique), qui pointe ce qui distingue cette prise.
- Choisis UNE seule prise canonique (canonicalRecordingId).
- Si les prises se valent, prends la plus récente (elle incorpore les ajustements de l'entrepreneur).

## Question à comparer
questionId : ${questionId} (session ${sessionId})

## Prises
${takesBlock}

Retourne un objet JSON avec { canonicalRecordingId, reason, criteria { tempo, clarity, energy, tone } }.`

    const { object } = await generateObject({
      model: getDefaultModel(),
      schema: TakeAnalysisSchema,
      prompt,
    })
    // Garde-fou : si le LLM hallucine un id inconnu, on fallback sur la plus récente.
    if (!group.some((r) => r.id === object.canonicalRecordingId)) {
      return { ...object, canonicalRecordingId: group[group.length - 1].id }
    }
    return object
  }

  private extractDuration(wordTimestamps: Prisma.JsonValue): number | null {
    if (!wordTimestamps || !Array.isArray(wordTimestamps)) return null
    const last = wordTimestamps[wordTimestamps.length - 1] as { end?: number } | undefined
    if (typeof last?.end === 'number') return last.end
    return null
  }

  private aggregateScore(criteria: TakeAnalysisResult['criteria']): number {
    return (criteria.tempo + criteria.clarity + criteria.energy + criteria.tone) / 4
  }
}
