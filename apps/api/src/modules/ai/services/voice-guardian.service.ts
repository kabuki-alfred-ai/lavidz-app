import { Injectable, Logger } from '@nestjs/common'
import { generateObject } from '../providers/ai-sdk'
import { z } from 'zod'
import { prisma, Prisma } from '@lavidz/database'
import { getDefaultModel } from '../providers/model.config'

const VoiceSampleSchema = z.object({
  openingPatterns: z.array(z.string()).max(6).describe(
    "Ouvertures récurrentes observées dans cette transcription — ex: 'Bon alors', 'Vous savez quoi', 'Soyons honnêtes'",
  ),
  linguisticTics: z.array(z.string()).max(8).describe(
    "Tics de langage et tournures caractéristiques — ex: 'au fond', 'concrètement', 'ce qui m'a frappé'",
  ),
  toneMarkers: z.array(z.string()).min(1).max(5).describe(
    "Adjectifs qui caractérisent le ton — direct, challengeur, chaleureux, posé, incisif, etc.",
  ),
  averageSentenceLength: z.number().describe('Nombre moyen de mots par phrase'),
  lexicon: z.array(z.string()).max(12).describe(
    "Mots métier / lexique spécifique utilisés dans cette prise (pas de mots très génériques)",
  ),
})

type VoiceSample = z.infer<typeof VoiceSampleSchema>

type VoiceGuideState = {
  samplesCount: number
  openingPatterns: string[]
  linguisticTics: string[]
  toneMarkers: string[]
  averageSentenceLength: number
  lexicon: string[]
  lastUpdatedAt: string
}

function mergeUnique(existing: string[], fresh: string[], maxSize: number): string[] {
  const seen = new Set(existing.map((s) => s.toLowerCase()))
  const merged = [...existing]
  for (const item of fresh) {
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
    if (merged.length >= maxSize) break
  }
  return merged.slice(0, maxSize)
}

/**
 * VoiceGuardian — analyzes a tournage transcription and enriches the
 * entrepreneur's voice profile in two places :
 *
 *  1. `EntrepreneurProfile.businessContext.voiceGuide` : a structured JSON
 *     (openingPatterns, linguisticTics, toneMarkers, averageSentenceLength,
 *     lexicon) — accumulated across tournages, used for fine-grained style
 *     comparison and the post-recording "gardien de la voix" checks.
 *
 *  2. `EntrepreneurProfile.communicationStyle` : a human-readable Markdown
 *     paragraph automatically regenerated from the structured guide, fed into
 *     Kabou's system prompts so propositions always sound like the
 *     entrepreneur (see project_lavidz_product_promise.md).
 */
@Injectable()
export class VoiceGuardianService {
  private readonly logger = new Logger(VoiceGuardianService.name)

  async enrichFromTranscription(params: {
    organizationId: string
    transcription: string
  }): Promise<void> {
    const { organizationId, transcription } = params

    const trimmed = transcription.trim()
    if (trimmed.split(/\s+/).filter(Boolean).length < 60) {
      // Not enough material to learn something reliable
      return
    }

    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId },
    })
    if (!profile) {
      this.logger.warn(`VoiceGuardian: no profile for org ${organizationId}`)
      return
    }

    let sample: VoiceSample
    try {
      const { object } = await generateObject({
        model: getDefaultModel(),
        schema: VoiceSampleSchema,
        prompt: `Tu analyses une transcription d'un tournage vidéo pour en extraire des signatures vocales — sans juger, sans corriger, juste en décrivant factuellement les patterns observés.

Règles :
- Français, factuel, pas d'adjectifs flatteurs vides ("bien", "intéressant").
- Si un pattern n'est pas nettement présent, ne l'invente pas — tableau vide ok.
- Les patterns doivent être spécifiques à cette personne, pas génériques français.

Transcription :
"""
${trimmed.slice(0, 6000)}
"""

Retourne un JSON strict conforme au schema.`,
      })
      sample = object
    } catch (err) {
      this.logger.warn(`VoiceGuardian analysis failed: ${String(err)}`)
      return
    }

    const existingCtx = (profile.businessContext as Record<string, unknown> | null) ?? {}
    const existingGuide = (existingCtx.voiceGuide as VoiceGuideState | undefined) ?? null

    const n = (existingGuide?.samplesCount ?? 0) + 1

    // Rolling average for sentence length
    const nextAvg = existingGuide
      ? Math.round(
          ((existingGuide.averageSentenceLength || 0) * (n - 1) + sample.averageSentenceLength) / n,
        )
      : sample.averageSentenceLength

    const nextGuide: VoiceGuideState = {
      samplesCount: n,
      openingPatterns: mergeUnique(existingGuide?.openingPatterns ?? [], sample.openingPatterns, 8),
      linguisticTics: mergeUnique(existingGuide?.linguisticTics ?? [], sample.linguisticTics, 12),
      toneMarkers: mergeUnique(existingGuide?.toneMarkers ?? [], sample.toneMarkers, 6),
      averageSentenceLength: nextAvg,
      lexicon: mergeUnique(existingGuide?.lexicon ?? [], sample.lexicon, 20),
      lastUpdatedAt: new Date().toISOString(),
    }

    const nextContext = {
      ...existingCtx,
      voiceGuide: nextGuide,
    } as Prisma.InputJsonValue

    const humanSummary = this.renderVoiceSummary(nextGuide)

    await prisma.entrepreneurProfile.update({
      where: { organizationId },
      data: {
        businessContext: nextContext,
        communicationStyle: humanSummary,
      },
    })

    this.logger.log(
      `VoiceGuardian: profil mis à jour (${n} échantillon${n > 1 ? 's' : ''}) pour org ${organizationId}`,
    )
  }

  /**
   * Produce a human-readable paragraph summarising the voice guide. This is
   * what Kabou reads to tune its propositions — so it must be scannable,
   * factual, and actionable.
   */
  private renderVoiceSummary(guide: VoiceGuideState): string {
    const lines: string[] = []
    if (guide.toneMarkers.length > 0) {
      lines.push(`**Ton** : ${guide.toneMarkers.join(', ')}.`)
    }
    if (guide.openingPatterns.length > 0) {
      lines.push(`**Ouvertures fréquentes** : ${guide.openingPatterns.slice(0, 4).join(' / ')}.`)
    }
    if (guide.linguisticTics.length > 0) {
      lines.push(`**Tournures récurrentes** : ${guide.linguisticTics.slice(0, 5).join(', ')}.`)
    }
    if (guide.averageSentenceLength) {
      lines.push(`**Rythme moyen** : ${guide.averageSentenceLength} mots par phrase.`)
    }
    if (guide.lexicon.length > 0) {
      lines.push(`**Lexique** : ${guide.lexicon.slice(0, 8).join(', ')}.`)
    }
    lines.push(
      `_Profil construit à partir de ${guide.samplesCount} tournage${guide.samplesCount > 1 ? 's' : ''} — mis à jour le ${new Date(guide.lastUpdatedAt).toLocaleDateString('fr-FR')}._`,
    )
    return lines.join('\n')
  }
}
