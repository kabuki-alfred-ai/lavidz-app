import { streamText, convertToModelMessages, tool, stepCountIs } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'

export const runtime = 'nodejs'
export const maxDuration = 60

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
})

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
      ? user.activeOrgId
      : user.organizationId
    if (!orgId) return new Response('No organization', { status: 400 })

    const { messages, threadId } = await req.json()
    const activeThreadId = threadId || messages[0]?.id || crypto.randomUUID()

    // Save the latest user message to DB
    const lastMsg = messages[messages.length - 1]
    if (lastMsg) {
      const content = lastMsg.content ?? lastMsg.parts?.find((p: any) => p.type === 'text')?.text ?? ''
      if (content && lastMsg.role === 'user') {
        await prisma.chatMessage.create({
          data: { organizationId: orgId, threadId: activeThreadId, role: 'user', content },
        }).catch(() => {})
      }
    }

    // Load profile and calendar
    let profile: any = null
    try {
      profile = await prisma.entrepreneurProfile.findFirst({ where: { organizationId: orgId } })
    } catch { /* no profile yet */ }

    let upcomingCalendar: any[] = []
    try {
      upcomingCalendar = await prisma.contentCalendar.findMany({
        where: { organizationId: orgId, status: 'PLANNED' },
        orderBy: { scheduledDate: 'asc' },
        take: 10,
      })
    } catch { /* table might not exist yet */ }

    // RAG: search relevant memories based on last user message
    let ragMemories: string[] = []
    try {
      const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
      const lastText = typeof lastUserMsg?.content === 'string'
        ? lastUserMsg.content
        : Array.isArray(lastUserMsg?.content)
          ? lastUserMsg.content.filter((p: { type: string }) => p.type === 'text').map((p: { text: string }) => p.text).join(' ')
          : lastUserMsg?.parts?.find((p: { type: string }) => p.type === 'text')?.text ?? ''

      if (lastText.trim() && orgId) {
        const API = process.env.API_URL ?? 'http://localhost:3001'
        const ragRes = await fetch(
          `${API}/api/ai/memories/search?q=${encodeURIComponent(lastText)}&k=5`,
          { headers: { 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId } },
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

    // Build system prompt
    const systemParts: string[] = []

    // Build user display name
    const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined

    systemParts.push(`Tu es Kabou, un assistant IA chaleureux et complice, dedie aux entrepreneurs createurs de contenu video.

QUI TU ES :
Tu es comme un ami proche qui connait parfaitement le business de l'entrepreneur et l'aide a raconter son histoire en video. Tu es curieux, bienveillant, parfois drole — jamais froid ni corporatif. Tu t'investis sincerement dans la reussite de la personne en face de toi. Tu tutoies toujours.

REGLES :
- Reponds TOUJOURS en francais
- Pose UNE SEULE question a la fois, naturellement, comme dans une vraie conversation
- Creuse ce qui est interessant, rebondis sur les details, montre que tu retiens tout
- Adapte-toi a l'humeur — parfois il veut reflechir a voix haute, partager une nouvelle, demander un avis
- Ne repose JAMAIS une information que tu connais deja
- Quand tu utilises un outil, explique brievement ce que tu fais
- Sois humain, chaleureux, affectueux — comme un vrai complice`)

    if (userName) {
      systemParts.push(`\nIDENTITE : Tu parles avec ${userName}. Utilise son prenom naturellement.`)
    }

    if (profile) {
      const bc = profile.businessContext as Record<string, unknown>
      if (bc && Object.keys(bc).length > 0) {
        const summary = bc.summary as Record<string, unknown> | undefined
        if (summary && Object.keys(summary).length > 0) {
          const lines = ['\nCE QUE TU SAIS DEJA SUR CET ENTREPRENEUR :']
          if (summary.activite) lines.push(`- Activite : ${summary.activite}`)
          if (summary.stade) lines.push(`- Stade : ${summary.stade}`)
          if (summary.clientsCibles) lines.push(`- Clients cibles : ${summary.clientsCibles}`)
          if (summary.problemeResolu) lines.push(`- Probleme resolu : ${summary.problemeResolu}`)
          if (summary.objectifsContenu) lines.push(`- Objectifs contenu : ${summary.objectifsContenu}`)
          if (summary.styleComm) lines.push(`- Style de communication : ${summary.styleComm}`)
          lines.push('\nUtilise ce contexte pour personnaliser la conversation. Ne repose pas les questions deja repondues.')
          systemParts.push(lines.join('\n'))
        } else if (Object.keys(bc).length > 0) {
          systemParts.push(`\nPROFIL : ${JSON.stringify(bc)}`)
        }
      }
      if (profile.editorialPillars?.length > 0) {
        systemParts.push(`\nLIGNE EDITORIALE : Piliers=${profile.editorialPillars.join(', ')} | Ton=${profile.editorialTone ?? '?'} | Freq=${profile.targetFrequency ?? '?'}/sem | Plateformes=${profile.targetPlatforms?.join(', ') ?? '?'}`)
      }
    }

    if (upcomingCalendar.length > 0) {
      systemParts.push(`\nCALENDRIER :\n${upcomingCalendar.map(e => `- ${new Date(e.scheduledDate).toLocaleDateString('fr-FR')} : ${e.topic} (${e.format})`).join('\n')}`)
    }

    if (ragMemories.length > 0) {
      const lines = ['\nSOUVENIRS PERTINENTS (memoire vectorielle) :']
      ragMemories.forEach((m) => lines.push(`- ${m}`))
      lines.push('\nCes souvenirs sont lies au message actuel. Utilise-les naturellement si pertinents, sans les citer mot pour mot.')
      systemParts.push(lines.join('\n'))
    }

    // Recording instructions
    systemParts.push(`\nENREGISTREMENT VIDEO :
Quand l'utilisateur veut enregistrer une video :
- Si le message contient deja un sujet ET un format precis (ex: "Je veux enregistrer la video X (format: STORYTELLING)"), appelle DIRECTEMENT create_recording_session sans poser de questions supplementaires. Genere les questions/script toi-meme et cree la session.
- Sinon, prepare les questions, presente-les et demande validation avant d'appeler create_recording_session.

Formats et leurs donnees :
- QUESTION_BOX / STORYTELLING / MYTH_VS_REALITY → passe des questions avec hints
- TELEPROMPTER → passe un teleprompterScript structure en POINTS CLES. Format : sections [HOOK], [CONTENU], [CTA] avec des bullet points concis
- HOT_TAKE / DAILY_TIP → passe 1-3 points de guidage comme questions

Le lien d'enregistrement s'affiche automatiquement dans le chat apres l'appel.`)

    if (!profile?.editorialValidated) {
      systemParts.push(`\nMISSION : ONBOARDING
L'utilisateur n'a pas de ligne editoriale. Collecte progressivement :
1. Metier / expertise
2. Plateformes cibles
3. Rythme (videos/semaine)
4. Ton prefere
5. 3-5 piliers de contenu
Puis appelle set_editorial_line, puis generate_calendar.
IMPORTANT : Si l'utilisateur demande quand meme a enregistrer une video, fais-le directement meme sans onboarding termine.`)
    } else {
      systemParts.push(`\nMISSION : MODE LIBRE
Aide a modifier le calendrier, ajuster la ligne, trouver des idees, preparer des videos.`)
    }

    const modelMessages = await convertToModelMessages(messages)
    const tavilyKey = process.env.TAVILY_API_KEY ?? ''

    if (tavilyKey) {
      systemParts.push(`\nRECHERCHE WEB :
Tu as acces a un outil de recherche web (webSearch). Utilise-le quand c'est pertinent :
- Quand l'utilisateur pose une question factuelle
- Pour chercher des tendances, actualites ou idees de contenu
- Pour trouver des infos sur un sujet specifique
- Integre les resultats naturellement dans ta reponse`)
    }

    const result = streamText({
      model: google('gemini-3.1-flash-lite-preview'),
      system: systemParts.join('\n'),
      messages: modelMessages,
      stopWhen: tavilyKey ? stepCountIs(3) : stepCountIs(1),
      onFinish: async ({ text, toolCalls }) => {
        // Save assistant response to DB
        if (text) {
          await prisma.chatMessage.create({
            data: {
              organizationId: orgId,
              threadId: activeThreadId,
              role: 'assistant',
              content: text,
              toolCalls: toolCalls?.length ? JSON.parse(JSON.stringify(toolCalls)) : undefined,
            },
          }).catch(() => {})
        }
      },
      tools: {
        ...(tavilyKey ? {
          webSearch: tool({
            description: "Recherche sur le web pour trouver des informations actuelles et pertinentes.",
            inputSchema: z.object({
              query: z.string().describe("La requete de recherche"),
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
                console.error('[chat] Tavily search failed', res.status)
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
        } : {}),
        update_profile: {
          description: "Met a jour le profil business de l'utilisateur",
          inputSchema: z.object({
            businessContext: z.string().optional().describe('Contexte business'),
            communicationStyle: z.string().optional().describe('Style de communication'),
          }),
          execute: async ({ businessContext, communicationStyle }) => {
            const data: Record<string, unknown> = {}
            if (businessContext) {
              try { data.businessContext = JSON.parse(businessContext) } catch { data.businessContext = { description: businessContext } }
            }
            if (communicationStyle) data.communicationStyle = communicationStyle
            await prisma.entrepreneurProfile.upsert({
              where: { organizationId: orgId },
              update: data,
              create: { organization: { connect: { id: orgId } }, ...data },
            })
            return { success: true, updated: Object.keys(data) }
          },
        },
        set_editorial_line: {
          description: "Definit la ligne editoriale. Appeler quand tu as collecte piliers, ton, frequence et plateformes.",
          inputSchema: z.object({
            pillars: z.array(z.string()).describe('3-5 piliers de contenu'),
            tone: z.string().describe('Ton editorial'),
            frequency: z.number().describe('Videos par semaine'),
            platforms: z.array(z.string()).describe('Plateformes cibles'),
          }),
          execute: async ({ pillars, tone, frequency, platforms }) => {
            await prisma.entrepreneurProfile.upsert({
              where: { organizationId: orgId },
              update: { editorialPillars: pillars, editorialTone: tone, targetFrequency: frequency, targetPlatforms: platforms, editorialValidated: true },
              create: { organization: { connect: { id: orgId } }, editorialPillars: pillars, editorialTone: tone, targetFrequency: frequency, targetPlatforms: platforms, editorialValidated: true },
            })
            return { success: true, pillars, tone, frequency, platforms }
          },
        },
        generate_calendar: {
          description: "Genere un calendrier de contenu. Appeler apres avoir defini la ligne editoriale.",
          inputSchema: z.object({
            weeksCount: z.number().default(4).describe('Semaines a planifier'),
            videosPerWeek: z.number().default(3).describe('Videos par semaine'),
          }),
          execute: async ({ weeksCount = 4, videosPerWeek = 3 }) => {
            const p = await prisma.entrepreneurProfile.findFirst({ where: { organizationId: orgId } })
            const res = await fetch(`${process.env.API_URL ?? 'http://localhost:3001'}/api/ai/generate-calendar`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
              body: JSON.stringify({ platforms: p?.targetPlatforms ?? ['linkedin'], weeksCount, videosPerWeek }),
            })
            if (!res.ok) return { success: false, error: await res.text() }
            const data = await res.json()
            return { success: true, count: data.generated ?? data.entries?.length ?? 0 }
          },
        },
        regenerate_calendar: {
          description: "Regenere le calendrier en supprimant les planifies.",
          inputSchema: z.object({}),
          execute: async () => {
            const deleted = await prisma.contentCalendar.deleteMany({ where: { organizationId: orgId, status: 'PLANNED' } })
            const p = await prisma.entrepreneurProfile.findFirst({ where: { organizationId: orgId } })
            const res = await fetch(`${process.env.API_URL ?? 'http://localhost:3001'}/api/ai/generate-calendar`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
              body: JSON.stringify({ platforms: p?.targetPlatforms ?? ['linkedin'], weeksCount: 4, videosPerWeek: p?.targetFrequency ?? 3 }),
            })
            if (!res.ok) return { success: false, error: await res.text() }
            const data = await res.json()
            return { success: true, deleted: deleted.count, count: data.generated ?? data.entries?.length ?? 0 }
          },
        },
        update_calendar_entry: {
          description: "Modifie un item du calendrier.",
          inputSchema: z.object({
            entryId: z.string().describe("ID de l'entree"),
            topic: z.string().optional().describe('Nouveau sujet'),
            description: z.string().optional().describe('Nouvelle description'),
          }),
          execute: async ({ entryId, topic, description }) => {
            const data: Record<string, unknown> = {}
            if (topic) data.topic = topic
            if (description) data.description = description
            const entry = await prisma.contentCalendar.update({ where: { id: entryId }, data })
            return { success: true, entry: { id: entry.id, topic: entry.topic, format: entry.format, scheduledDate: entry.scheduledDate } }
          },
        },
        create_recording_session: {
          description: `Cree une session d'enregistrement video et retourne le lien. Appeler quand l'utilisateur a valide les questions ou le script et veut enregistrer.
Pour le format TELEPROMPTER : passe un script structure avec des sections [HOOK], [CONTENU], [CTA].
Pour les formats QUESTION_BOX, STORYTELLING, MYTH_VS_REALITY : passe des questions avec hints.
Pour les formats HOT_TAKE, DAILY_TIP : passe 1-3 points de guidage comme questions.`,
          inputSchema: z.object({
            title: z.string().describe('Titre de la session'),
            format: z.enum(['QUESTION_BOX', 'TELEPROMPTER', 'HOT_TAKE', 'STORYTELLING', 'DAILY_TIP', 'MYTH_VS_REALITY']).describe('Format de contenu'),
            platform: z.string().default('linkedin').describe('Plateforme cible'),
            questions: z.array(z.object({
              text: z.string().describe('Texte de la question ou du point de guidage'),
              hint: z.string().optional().describe('Indication pour aider le createur'),
            })).optional().describe('Questions ou points de guidage (tous formats sauf TELEPROMPTER)'),
            teleprompterScript: z.string().optional().describe('Points cles structures pour le teleprompter (format TELEPROMPTER uniquement). Utilise des sections [HOOK], [CONTENU], [CTA] avec des bullet points concis — PAS un script a reciter mot pour mot'),
            calendarEntryId: z.string().optional().describe('ID de l\'entree du calendrier a lier (si applicable)'),
          }),
          execute: async ({ title, format, platform, questions, teleprompterScript, calendarEntryId }) => {
            try {
              // Create slug
              const slug = `${title
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')}-${Date.now()}`

              // Create theme with questions
              const questionData = format === 'TELEPROMPTER'
                ? [{ text: title, hint: 'Suis le script affiche a l\'ecran', order: 0 }]
                : (questions ?? [{ text: title, hint: null }]).map((q: { text: string; hint?: string | null }, i: number) => ({
                    text: q.text,
                    hint: q.hint ?? null,
                    order: i,
                  }))

              const theme = await prisma.theme.create({
                data: {
                  name: title,
                  slug,
                  organizationId: orgId,
                  questions: { create: questionData },
                },
              })

              // Create session with format and script
              const session = await prisma.session.create({
                data: {
                  themeId: theme.id,
                  contentFormat: format as any,
                  targetPlatforms: [platform],
                  teleprompterScript: format === 'TELEPROMPTER' ? (teleprompterScript ?? null) : null,
                },
              })

              // Link to calendar entry if provided
              if (calendarEntryId) {
                const entry = await prisma.contentCalendar.findUnique({ where: { id: calendarEntryId } })
                if (entry) {
                  await prisma.contentCalendar.update({
                    where: { id: calendarEntryId },
                    data: { sessionId: session.id, status: 'RECORDED' },
                  })
                }
              }

              const baseUrl = process.env.WEB_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
              const shareLink = `${baseUrl}/s/${session.id}`

              return {
                success: true,
                sessionId: session.id,
                shareLink,
                title,
                format,
                platform,
                questionsCount: questionData.length,
              }
            } catch (err: any) {
              return { success: false, error: err.message ?? 'Erreur lors de la creation de la session' }
            }
          },
        },
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (err: any) {
    console.error('Chat API error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
