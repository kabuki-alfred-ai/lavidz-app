export const runtime = 'nodejs'

import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { getFreshUser } from '@/lib/get-fresh-user'

const MODEL_ID = process.env.AI_MODEL ?? 'gemini-2.0-flash'
const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

const BASE_SYSTEM = `Tu es Kabou, un assistant IA chaleureux et complice, dédié aux entrepreneurs créateurs de contenu vidéo.

**QUI TU ES**
Tu es comme un ami proche qui connaît parfaitement le business de l'entrepreneur et l'aide à raconter son histoire en vidéo. Tu es curieux, bienveillant, parfois drôle — jamais froid ni corporatif. Tu t'investis sincèrement dans la réussite de la personne en face de toi.

Quand tu reçois le message "__INIT__", présente-toi chaleureusement : dis que tu es Kabou, que tu es là pour aider à créer du contenu vidéo, utilise le prénom si tu le connais, et pose une première question ouverte sur ce qui se passe en ce moment dans son business. Sois naturel, chaleureux, enthousiaste — comme si tu retrouvais un ami.

**TON RÔLE PRINCIPAL — COMPRENDRE ET MÉMORISER**
Tu construis une connaissance profonde et évolutive de l'entrepreneur : son business, son parcours, ses clients, ses défis, ses victoires, sa façon de penser. Tu es là pour écouter, comprendre, et approfondir.

- Pose UNE seule question à la fois, naturellement, comme dans une vraie conversation
- Creuse ce qui est intéressant, rebondis sur les détails, montre que tu retiens tout
- Adapte-toi à l'humeur — parfois il veut réfléchir à voix haute, partager une nouvelle, demander un avis
- Ne cherche PAS à tout cataloguer — laisse la conversation être naturelle et vivante
- Ne repose JAMAIS une information que tu connais déjà (voir profil ci-dessous)

**GÉNÉRATION DE QUESTIONNAIRES — UNIQUEMENT SI DEMANDÉ**
Tu ne génères un questionnaire QUE si l'entrepreneur le demande explicitement (ex : "crée un questionnaire", "génère des questions", "je veux faire une session vidéo").

Quand il le demande, collecte ces 3 infos AVANT de générer — une à la fois, dans le flux naturel de la conversation :
1. **Thématique** : de quoi parlera la session ? (si pas déjà mentionné)
2. **Nombre de questions** : combien ? (propose 3-8 si indécis)
3. **Format** : questions courtes et directes, ou longues et réflexives ?

Une fois les 3 obtenues, génère le questionnaire avec ce format EXACT, JSON sur une seule ligne :

<<<QUESTIONNAIRE>>>
{"themeTitle":"Titre du thème","questions":[{"text":"Question 1 ?","hint":"Conseil pour répondre","order":1},{"text":"Question 2 ?","hint":"Conseil","order":2}]}
<<<END>>>

**DEMANDE LINKEDIN**
Quand le moment est naturel dans la conversation (après avoir bien cerné le business, vers 3-5 échanges) ET que LinkedIn n'est pas encore connecté, invite l'entrepreneur à partager son profil LinkedIn avec ce format EXACT — le texte d'invitation suivi IMMÉDIATEMENT du marqueur :

[texte d'invitation chaleureux et naturel]
<<<LINKEDIN>>>

RÈGLES pour <<<LINKEDIN>>> :
- N'utilise ce marqueur QU'UNE SEULE FOIS par conversation
- Si LinkedIn est déjà connecté (indiqué dans le profil), n'utilise JAMAIS ce marqueur
- Si l'entrepreneur a déjà répondu (oui ou non), n'utilise PLUS ce marqueur
- Le marqueur remplace le fait de demander l'URL directement — ne demande JAMAIS l'URL dans le texte

**RÈGLES ABSOLUES**
- Réponds TOUJOURS en français
- Ne propose JAMAIS un questionnaire de ta propre initiative
- Sois humain, chaleureux, affectueux — comme un vrai complice
- Utilise le prénom de l'entrepreneur naturellement dans la conversation`

type AiSummary = {
  activite?: string
  stade?: string
  clientsCibles?: string
  problemeResolu?: string
  objectifsContenu?: string
  styleComm?: string
  pointsForts?: string[]
  lacunes?: string[]
}

function buildSystemPrompt(
  summary?: AiSummary,
  topicsExplored?: string[],
  userName?: string,
  ragMemories?: string[],
  linkedinUrl?: string | null,
): string {
  const parts: string[] = [BASE_SYSTEM]

  if (userName) {
    parts.push(`\n\n---\n**IDENTITÉ :** Tu parles avec ${userName}. Utilise son prénom naturellement dans la conversation.`)
  }

  if (summary && Object.keys(summary).length > 0) {
    const lines = [
      '\n\n---\n**CE QUE TU SAIS DÉJÀ SUR CET ENTREPRENEUR :**',
    ]
    if (summary.activite)        lines.push(`- Activité : ${summary.activite}`)
    if (summary.stade)           lines.push(`- Stade : ${summary.stade}`)
    if (summary.clientsCibles)   lines.push(`- Clients cibles : ${summary.clientsCibles}`)
    if (summary.problemeResolu)  lines.push(`- Problème résolu : ${summary.problemeResolu}`)
    if (summary.objectifsContenu) lines.push(`- Objectifs contenu : ${summary.objectifsContenu}`)
    if (summary.styleComm)       lines.push(`- Style de communication : ${summary.styleComm}`)
    if (summary.pointsForts?.length) lines.push(`- Points forts : ${summary.pointsForts.join(', ')}`)
    if (summary.lacunes?.length) lines.push(`- ⚠️ Informations MANQUANTES à combler : ${summary.lacunes.join(', ')}`)
    if (topicsExplored?.length)  lines.push(`- Thèmes déjà filmés : ${topicsExplored.join(', ')}`)
    if (linkedinUrl) {
      lines.push(`- LinkedIn connecté : ${linkedinUrl} (ne demande PAS l'URL LinkedIn, c'est déjà fait)`)
    } else {
      lines.push(`- LinkedIn NON connecté`)
    }

    lines.push('\nUtilise ce contexte pour personnaliser la conversation. Ne repose pas les questions déjà répondues. Au fil de la conversation, comble naturellement les informations manquantes listées ci-dessus — une à la fois, sans faire un interrogatoire.')
    parts.push(lines.join('\n'))
  }

  if (ragMemories && ragMemories.length > 0) {
    const lines = ['\n\n---\n**SOUVENIRS PERTINENTS (mémoire vectorielle) :**']
    ragMemories.forEach((m) => lines.push(`- ${m}`))
    lines.push('\nCes souvenirs sont liés au message actuel. Utilise-les naturellement si pertinents, sans les citer mot pour mot.')
    parts.push(lines.join('\n'))
  }

  return parts.join('')
}

export async function POST(req: Request) {
  const user = await getFreshUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { messages } = await req.json()

  // Build user display name from session
  const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined

  // Fetch current profile to inject context into system prompt
  let summary: AiSummary | undefined
  let topicsExplored: string[] | undefined
  let linkedinUrl: string | null = null
  try {
    if (user.effectiveOrgId) {
      const profileRes = await fetch(`${API}/api/ai/profile`, {
        headers: { 'x-admin-secret': ADMIN_SECRET, 'x-organization-id': user.effectiveOrgId },
      })
      if (profileRes.ok) {
        const profile = await profileRes.json()
        summary = profile.businessContext?.summary
        topicsExplored = profile.topicsExplored
        linkedinUrl = profile.linkedinUrl ?? null
      }
    }
  } catch {
    // Non-blocking: continue without profile context
  }

  // RAG: search relevant memories based on last user message
  let ragMemories: string[] = []
  try {
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    const lastText = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? lastUserMsg.content.filter((p: { type: string }) => p.type === 'text').map((p: { text: string }) => p.text).join(' ')
        : ''

    if (lastText.trim() && lastText !== '__INIT__' && user.effectiveOrgId) {
      const ragRes = await fetch(
        `${API}/api/ai/memories/search?q=${encodeURIComponent(lastText)}&k=5`,
        { headers: { 'x-admin-secret': ADMIN_SECRET, 'x-organization-id': user.effectiveOrgId } },
      )
      if (ragRes.ok) {
        const { results } = await ragRes.json()
        ragMemories = results
          .filter((r: { similarity: number }) => r.similarity > 0.65)
          .map((r: { content: string }) => r.content)
      }
    }
  } catch {
    // Non-blocking
  }

  const result = streamText({
    model: google(MODEL_ID),
    system: buildSystemPrompt(summary, topicsExplored, userName, ragMemories, linkedinUrl),
    messages,
  })

  return result.toTextStreamResponse()
}
