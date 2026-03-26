export const runtime = 'nodejs'

import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { getFreshUser } from '@/lib/get-fresh-user'

const MODEL_ID = process.env.AI_MODEL ?? 'gemini-2.0-flash'

const SYSTEM_PROMPT = `Tu es un assistant expert en création de contenu vidéo pour entrepreneurs.
Ton rôle est de découvrir le business de l'entrepreneur à travers une conversation naturelle et bienveillante.

OBJECTIF : Collecter ces informations de manière conversationnelle (PAS un formulaire) :
1. Description de l'activité et du business
2. Stade actuel (démarrage, croissance, établi)
3. Clients cibles et problèmes résolus
4. Objectif avec le contenu vidéo
5. Style de communication souhaité
6. Thèmes clés à aborder

RÈGLES :
- Pose UNE seule question à la fois
- Adapte tes questions aux réponses précédentes (creuse, rebondis, montre de l'intérêt)
- Sois chaleureux, curieux, jamais robotique
- Si une réponse est vague, relance avec une question précise
- Après 6-8 échanges, conclus en résumant ce que tu as compris et annonce que le profil est sauvegardé
- Réponds TOUJOURS en français
- Commence par te présenter brièvement et poser la première question sur le business`

export async function POST(req: Request) {
  const user = await getFreshUser()
  if (!user || user.role !== 'SUPERADMIN') {
    return new Response('Unauthorized', { status: 401 })
  }

  const { messages } = await req.json()

  const result = streamText({
    model: google(MODEL_ID),
    system: SYSTEM_PROMPT,
    messages,
  })

  return result.toTextStreamResponse()
}
