export const runtime = 'nodejs'

import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth'

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '' })
const model = google(process.env.AI_MODEL ?? 'gemini-2.5-flash')

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { field, transcript } = (await req.json()) as { field: string; transcript: string }
    if (!transcript?.trim()) return new Response('Missing transcript', { status: 400 })

    if (field === 'editorialPillars') {
      const { object } = await generateObject({
        model,
        schema: z.object({ pillars: z.array(z.string().max(40)).min(1).max(8) }),
        prompt: `Tu es un assistant qui aide des entrepreneurs à définir leurs piliers de contenu vidéo.

Transcription vocale de l'entrepreneur : "${transcript}"

Extrait les domaines / piliers de contenu mentionnés ou sous-entendus. Formule chaque pilier en 1 à 5 mots, en français, à la manière d'un thème de contenu (ex: "stratégie produit", "management", "levée de fonds"). Retourne entre 2 et 6 piliers pertinents.`,
      })
      return Response.json({ value: object.pillars })
    }

    if (field === 'communicationStyle') {
      const { object } = await generateObject({
        model,
        schema: z.object({ style: z.string() }),
        prompt: `Tu es un assistant qui aide des entrepreneurs à décrire leur style de communication pour du contenu vidéo.

Transcription vocale de l'entrepreneur : "${transcript}"

Rédige une description concise (2-4 phrases) du style de communication, du ton et de la façon de s'exprimer de cet entrepreneur. Écris à la deuxième personne, en français, comme si tu lui décrivais son propre style. Capture les nuances : humour, direct/indirect, formel/informel, niveau d'émotion, etc.`,
      })
      return Response.json({ value: object.style })
    }

    return new Response('Unknown field', { status: 400 })
  } catch (err) {
    console.error('[voice-format]', err)
    return new Response('Formatting failed', { status: 500 })
  }
}
