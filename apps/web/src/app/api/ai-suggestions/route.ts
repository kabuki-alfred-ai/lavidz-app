import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '' })

const SuggestionsSchema = z.object({
  brollSuggestions: z.array(z.object({
    timestamp: z.number().describe('Seconde dans la video ou le B-roll doit commencer'),
    duration: z.number().describe('Duree suggeree du B-roll en secondes'),
    searchQuery: z.string().describe('Terme de recherche Pexels en anglais pour trouver un B-roll pertinent'),
    reason: z.string().describe('Pourquoi ce B-roll est suggere ici (en francais)'),
  })),
  hookAnalysis: z.object({
    currentHookEndTime: z.number().describe('Quand le hook actuel se termine (en secondes)'),
    hookQuality: z.enum(['strong', 'medium', 'weak']),
    suggestion: z.string().describe('Comment ameliorer le hook si necessaire (en francais)'),
  }),
  paceAnalysis: z.object({
    averageSentenceDuration: z.number(),
    slowSections: z.array(z.object({
      startTime: z.number(),
      endTime: z.number(),
      suggestion: z.string().describe('Suggestion pour ameliorer le rythme (en francais)'),
    })),
  }),
  subtitleHighlights: z.array(z.object({
    word: z.string(),
    reason: z.string().describe('Pourquoi ce mot devrait etre mis en evidence (en francais)'),
  })),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { transcript, wordTimestamps, duration, platform, format } = body

    if (!transcript) {
      return NextResponse.json({ error: 'transcript requis' }, { status: 400 })
    }

    const prompt = `Tu es un monteur video expert specialise dans le personal branding sur les reseaux sociaux.

Analyse cette transcription et propose des suggestions de montage pour maximiser l'engagement.

## Transcription
${transcript}

## Timestamps des mots
${wordTimestamps ? JSON.stringify(wordTimestamps.slice(0, 200)) : 'Non disponibles'}

## Duree totale : ${duration ?? 'inconnue'} secondes
## Plateforme cible : ${platform ?? 'linkedin'}
## Format : ${format ?? 'general'}

## Tes suggestions doivent couvrir :

1. **B-rolls** : Identifie 3-5 moments ou un B-roll ameliorerait la video. Pour chaque moment, donne un timestamp precis, une duree suggeree (2-5s), et un terme de recherche Pexels pertinent. Les B-rolls cassent la monotonie du talking head et illustrent le propos.

2. **Analyse du hook** : Evalue la force du hook (les 3 premieres secondes). Est-ce que ca capte l'attention immediatement ? Le hook est-il fort, moyen ou faible ?

3. **Analyse du rythme** : Identifie les sections ou le rythme ralentit (phrases longues, hesitations). Ces sections sont candidates a des coupes ou des zooms dynamiques.

4. **Mots-cles a mettre en evidence** : Identifie 5-8 mots importants de la transcription qui devraient etre mis en surbrillance dans les sous-titres (mots d'action, chiffres, mots emotionnels).

IMPORTANT : Toutes tes reponses textuelles (reason, suggestion, etc.) doivent etre en FRANCAIS. Seuls les searchQuery Pexels restent en anglais pour de meilleurs resultats de recherche.

Reponds uniquement avec le JSON structure demande.`

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: SuggestionsSchema,
      prompt,
    })

    return NextResponse.json(object)
  } catch (error: any) {
    console.error('AI suggestions error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Erreur lors de la generation des suggestions' },
      { status: 500 },
    )
  }
}
