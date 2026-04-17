export const runtime = 'nodejs'

import { streamText, tool, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod/v4'
import { getFreshUser } from '@/lib/get-fresh-user'

const MODEL_ID = process.env.AI_MODEL ?? 'gemini-3.1-flash-lite-preview'
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
  hasWebSearch?: boolean,
): string {
  const parts: string[] = [BASE_SYSTEM]

  if (hasWebSearch) {
    parts.push(`\n\n**RECHERCHE WEB**
Tu as accès à un outil de recherche web (webSearch). Utilise-le quand c'est pertinent :
- Quand l'entrepreneur te pose une question factuelle que tu ne peux pas vérifier de mémoire
- Pour chercher des tendances de marché, actualités de son secteur, ou idées de contenu
- Pour trouver des infos sur un sujet spécifique lié à son business
- Ne l'utilise PAS systématiquement — seulement quand la recherche apporte une vraie valeur
- Intègre les résultats naturellement dans ta réponse, sans lister les sources de façon robotique`)
  }

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
      } else {
        console.warn('[ai/chat] profile fetch failed', profileRes.status, await profileRes.text())
      }
    } else {
      console.warn('[ai/chat] effectiveOrgId is null for user', user.userId, 'role', user.role, 'orgId', user.organizationId, 'activeOrgId', user.activeOrgId)
    }
  } catch (err) {
    console.error('[ai/chat] profile fetch error', err)
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

  const tavilyKey = process.env.TAVILY_API_KEY ?? ''

  const result = streamText({
    model: google(MODEL_ID),
    system: buildSystemPrompt(summary, topicsExplored, userName, ragMemories, linkedinUrl, !!tavilyKey),
    messages,
    tools: tavilyKey ? {
      webSearch: tool({
        description: "Recherche sur le web pour trouver des informations actuelles et pertinentes. Utilise cet outil quand l'entrepreneur te pose une question factuelle, demande des tendances de marché, veut des idées de contenu basées sur l'actualité, ou quand tu as besoin d'informations à jour pour mieux le conseiller.",
        inputSchema: z.object({
          query: z.string().describe("La requête de recherche, en français ou anglais selon ce qui donnera les meilleurs résultats"),
        }),
        execute: async ({ query }: { query: string }) => {
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tavilyKey}`,
            },
            body: JSON.stringify({
              query,
              search_depth: 'basic',
              include_answer: true,
              max_results: 5,
            }),
          })
          if (!res.ok) {
            const errText = await res.text().catch(() => '')
            console.error('[ai/chat] Tavily search failed', res.status, errText)
            return { error: `Search failed: ${res.status}` }
          }
          const data = await res.json()
          return {
            answer: data.answer,
            results: data.results?.map((r: { title: string; url: string; content: string }) => ({
              title: r.title,
              url: r.url,
              content: r.content,
            })) ?? [],
          }
        },
      }),
    } : undefined,
    stopWhen: tavilyKey ? stepCountIs(3) : stepCountIs(1),
  })

  return result.toTextStreamResponse()
}
