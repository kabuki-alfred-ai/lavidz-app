import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 30

const IntroHooksSchema = z.object({
  hooks: z
    .array(
      z.object({
        phrase: z
          .string()
          .describe(
            'Phrase d\'accroche de 4 à 9 mots, courte, punchy. Écrite pour apparaître en gros à l\'écran au début de la vidéo.',
          ),
        angle: z
          .enum(['curiosite', 'contradiction', 'promesse', 'chiffre', 'aveu'])
          .describe('Le type d\'accroche utilisé'),
      }),
    )
    .length(3)
    .describe(
      'Exactement 3 propositions DIFFÉRENTES (angles variés), la plus forte en premier.',
    ),
})

export async function POST(req: Request) {
  const { transcript, topic, format } = await req.json()

  if (!transcript || typeof transcript !== 'string' || transcript.length < 40) {
    return new Response('transcript trop court (minimum 40 caractères)', { status: 400 })
  }

  const prompt = `Tu es un expert des vidéos virales courtes (TikTok, Reels, Shorts). Tu dois générer des phrases d'accroche pour la SLIDE D'INTRODUCTION d'une vidéo — c'est-à-dire une slide statique de 2-3 secondes qui s'affiche AVANT le contenu principal.

OBJECTIF : teaser le contenu de la vidéo et créer la curiosité, en 4 à 9 mots MAXIMUM.

Règles :
- Phrase courte, directe, percutante (pensée comme un gros titre)
- Peut contenir "..." pour créer du suspense
- Évite les "Bonjour", "Aujourd'hui on va voir", et tout intro plate
- Les 3 propositions doivent être TRÈS DIFFÉRENTES (angles variés)
- Classe les 3 propositions par ordre de puissance (la plus forte en premier)
- Pour chaque proposition, classe-la via "angle" : curiosite | contradiction | promesse | chiffre | aveu

Exemples de bons hooks d'intro :
- curiosité : "Ce que personne ne te dit sur..."
- contradiction : "Tout le monde se trompe sur X"
- promesse : "La méthode qui change tout"
- chiffre : "J'ai perdu 200 000 €, voici pourquoi"
- aveu : "J'avais complètement tort"

${topic ? `SUJET DE LA VIDÉO : ${topic}\n` : ''}${format ? `FORMAT : ${format}\n` : ''}
CONTENU DE LA VIDÉO (transcription) :
${transcript.slice(0, 4000)}
`

  try {
    const model = google(process.env.AI_MODEL ?? 'gemini-2.5-flash')
    const { object } = await generateObject({
      model,
      schema: IntroHooksSchema,
      prompt,
    })

    return Response.json({ hooks: object.hooks })
  } catch (err: any) {
    console.error('[intro-hooks] Gemini error:', err)
    return new Response(`Gemini erreur : ${err?.message ?? 'inconnue'}`, { status: 500 })
  }
}
