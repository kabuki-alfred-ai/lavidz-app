import { streamText, convertToModelMessages, tool, stepCountIs } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { KABOU_SYSTEM_PREAMBLE } from '@/lib/kabou-voice'

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

    const { messages, threadId, topicId } = await req.json()
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
        include: { topicEntity: { select: { name: true } } },
      })
    } catch { /* table might not exist yet */ }

    // Load topic context if topicId provided
    let currentTopic: { id: string; name: string; brief: string | null; status: string; pillar: string | null; threadId: string } | null = null
    if (topicId) {
      try {
        currentTopic = await prisma.topic.findFirst({
          where: { id: topicId, organizationId: orgId },
          select: { id: true, name: true, brief: true, status: true, pillar: true, threadId: true },
        })
      } catch { /* */ }
    }

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

    // Authoritative voice guide — canonical source is apps/web/src/lib/kabou-voice.ts.
    // The 10 rules, vocabulary and tonal guidance ship as a single preamble so the
    // LLM can't drift from the Kabou persona as features grow.
    systemParts.push(KABOU_SYSTEM_PREAMBLE)

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
      // Thèse — la conviction forte qui oriente tout. Chaque proposition doit la respecter.
      const thesis = profile.thesis as Record<string, unknown> | null
      if (thesis && typeof thesis.statement === 'string' && thesis.statement.trim().length > 0) {
        const enemies = Array.isArray(thesis.enemies) ? (thesis.enemies as string[]).filter(Boolean) : []
        const archetype = typeof thesis.audienceArchetype === 'string' ? thesis.audienceArchetype : ''
        const lines = [`\nTHESE DE L'ENTREPRENEUR : "${thesis.statement}"`]
        if (archetype) lines.push(`Archétype d'audience : ${archetype}`)
        if (enemies.length > 0) lines.push(`Idées reçues combattues : ${enemies.join(' / ')}`)
        lines.push('Toutes tes propositions (Sujets, angles, hooks) doivent être cohérentes avec cette thèse. Si un angle s\'en éloigne, signale-le.')
        systemParts.push(lines.join('\n'))
      }
    }

    if (upcomingCalendar.length > 0) {
      systemParts.push(`\nCALENDRIER :\n${upcomingCalendar.map(e => `- ${new Date(e.scheduledDate).toLocaleDateString('fr-FR')} : ${e.topicEntity?.name ?? ''} (${e.format})`).join('\n')}`)
    }

    if (ragMemories.length > 0) {
      const lines = ['\nSOUVENIRS PERTINENTS (memoire vectorielle) :']
      ragMemories.forEach((m) => lines.push(`- ${m}`))
      lines.push('\nCes souvenirs sont lies au message actuel. Utilise-les naturellement si pertinents, sans les citer mot pour mot.')
      systemParts.push(lines.join('\n'))
    }

    // Topic context
    if (currentTopic) {
      const topicLines = [`\nTU TRAVAILLES SUR LE SUJET : "${currentTopic.name}" (statut: ${currentTopic.status})`]
      if (currentTopic.brief) topicLines.push(`Brief actuel : ${currentTopic.brief}`)
      if (currentTopic.pillar) topicLines.push(`Pilier editorial : ${currentTopic.pillar}`)
      topicLines.push(`Concentre-toi sur ce sujet. Quand la conversation apporte un element important (nouvel angle, point cle, decision), appelle update_topic_brief pour enrichir le brief.`)
      if (currentTopic.status === 'DRAFT') {
        topicLines.push(`Ce sujet est en brouillon. Quand tu estimes que le brief est solide (angle clair, points cles definis, pret a etre enregistre), propose a l'entrepreneur : "Ce sujet est bien cadre, tu veux que je le marque comme pret ?" S'il accepte, appelle mark_topic_ready.`)
      }
      systemParts.push(topicLines.join('\n'))
    }

    // Topic creation instructions (for free chat only)
    if (!currentTopic) {
      systemParts.push(`\nCREATION DE SUJETS :
Quand un sujet interessant emerge dans la conversation et que l'entrepreneur semble vouloir en faire un contenu video, propose-lui de creer un Topic en disant quelque chose comme "Tu veux que j'en fasse un sujet de contenu ?". S'il accepte, appelle create_topic avec un nom et un brief resume. Ne force jamais la creation, c'est une proposition naturelle.`)
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
      stopWhen: stepCountIs(3),
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
        create_topic: tool({
          description: "Cree un nouveau sujet (Topic) a partir de la conversation. Appeler quand un sujet interessant emerge et que l'utilisateur veut en faire un contenu. Genere un brief resume a partir de la discussion.",
          inputSchema: z.object({
            name: z.string().describe("Nom court du sujet"),
            brief: z.string().describe("Resume de 2-3 phrases : angle retenu, points cles, pourquoi c'est pertinent pour l'entrepreneur"),
            pillar: z.string().optional().describe("Pilier editorial associe si pertinent"),
          }),
          execute: async ({ name, brief, pillar }: { name: string; brief: string; pillar?: string }) => {
            try {
              const API = process.env.API_URL ?? 'http://localhost:3001'
              const res = await fetch(`${API}/api/ai/topics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
                body: JSON.stringify({ name, brief, pillar, sourceThreadId: activeThreadId }),
              })
              if (!res.ok) return { success: false, error: await res.text() }
              const topic = await res.json()
              return { success: true, topicId: topic.id, name: topic.name, topicUrl: `/sujets/${topic.id}` }
            } catch (err: any) {
              return { success: false, error: err.message ?? 'Erreur lors de la creation du sujet' }
            }
          },
        }),
        ...(currentTopic ? {
          update_topic_brief: tool({
            description: "Met a jour le brief du Topic en cours quand un element important ressort de la conversation (nouvel angle, decision, point cle). N'appelle que quand c'est vraiment pertinent.",
            inputSchema: z.object({
              brief: z.string().describe("Le brief mis a jour, integrant les nouveaux elements de la conversation"),
            }),
            execute: async ({ brief }: { brief: string }) => {
              try {
                const API = process.env.API_URL ?? 'http://localhost:3001'
                const res = await fetch(`${API}/api/ai/topics/${currentTopic!.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
                  body: JSON.stringify({ brief }),
                })
                if (!res.ok) return { success: false, error: await res.text() }
                return { success: true, updated: true }
              } catch (err: any) {
                return { success: false, error: err.message }
              }
            },
          }),
          ...(currentTopic.status === 'DRAFT' ? {
            mark_topic_ready: tool({
              description: "Marque le sujet comme pret a etre enregistre. Appeler quand l'entrepreneur confirme que le sujet est suffisamment travaille.",
              inputSchema: z.object({}),
              execute: async () => {
                try {
                  const API = process.env.API_URL ?? 'http://localhost:3001'
                  const res = await fetch(`${API}/api/ai/topics/${currentTopic!.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
                    body: JSON.stringify({ status: 'READY' }),
                  })
                  if (!res.ok) return { success: false, error: await res.text() }
                  return { success: true, status: 'READY' }
                } catch (err: any) {
                  return { success: false, error: err.message }
                }
              },
            }),
          } : {}),
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
            if (description) data.description = description
            if (topic) {
              const current = await prisma.contentCalendar.findUnique({
                where: { id: entryId },
                select: { organizationId: true, topicId: true },
              })
              if (current) {
                const existingTopic = await prisma.topic.findFirst({
                  where: {
                    organizationId: current.organizationId,
                    name: { equals: topic, mode: 'insensitive' },
                    status: { not: 'ARCHIVED' },
                  },
                })
                const slug = `${topic
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/(^-|-$)/g, '')}-${Date.now()}`
                const newTopic =
                  existingTopic ??
                  (await prisma.topic.create({
                    data: { organizationId: current.organizationId, name: topic, slug },
                  }))
                data.topicId = newTopic.id
              }
            }
            const entry = await prisma.contentCalendar.update({
              where: { id: entryId },
              data,
              include: { topicEntity: { select: { name: true } } },
            })
            return {
              success: true,
              entry: {
                id: entry.id,
                topic: entry.topicEntity?.name ?? '',
                format: entry.format,
                scheduledDate: entry.scheduledDate,
              },
            }
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

              // Create session with format and script, linked to topic if available
              const session = await prisma.session.create({
                data: {
                  themeId: theme.id,
                  contentFormat: format as any,
                  targetPlatforms: [platform],
                  teleprompterScript: format === 'TELEPROMPTER' ? (teleprompterScript ?? null) : null,
                  topicId: currentTopic?.id ?? null,
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
        weekly_creative_review: tool({
          description: "Produit une revue hebdomadaire chaleureuse des 7 derniers jours de l'entrepreneur — patterns observés, forces, 1-3 invitations pour la suite. Utilise cet outil quand l'entrepreneur demande 'fais-moi un bilan', 'où j'en suis', 'qu'est-ce qui marche' — ou quand tu veux prendre la parole toi-même pour marquer une semaine. Retourne null si la semaine est vide (dans ce cas, dis-le doucement sans culpabiliser).",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const API = process.env.API_URL ?? 'http://localhost:3001'
              const res = await fetch(`${API}/api/ai/weekly-review`, {
                method: 'POST',
                headers: { 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
              })
              if (!res.ok) return { success: false, error: await res.text() }
              const data = await res.json()
              if (!data) {
                return {
                  success: true,
                  empty: true as const,
                  message: "Pas assez d'activité cette semaine pour une revue — on repart plus fort quand tu veux.",
                }
              }
              return { success: true, mode: 'weekly_review' as const, ...data }
            } catch (err: any) {
              return { success: false, error: err?.message ?? 'Revue indisponible' }
            }
          },
        }),
        explore_weekly_moment: tool({
          description: "Lance le mode 'Raconte-moi ta semaine' quand l'entrepreneur n'a pas d'idée. Retourne des ouvertures de conversation que Kabou peut enchaîner + les sujets/tournages récents comme repères. Utilise cet outil quand l'entrepreneur dit 'je suis bloqué', 'je sais pas quoi dire', 'j'ai pas d'idée aujourd'hui'. Après cet appel, Kabou doit **poser une question ouverte** parmi les openers et laisser l'entrepreneur parler librement.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const API = process.env.API_URL ?? 'http://localhost:3001'
              const res = await fetch(`${API}/api/ai/unstuck/weekly-moment`, {
                method: 'POST',
                headers: { 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
              })
              if (!res.ok) return { success: false, error: await res.text() }
              return { success: true, mode: 'weekly_moment' as const, ...(await res.json()) }
            } catch (err: any) {
              return { success: false, error: err?.message ?? 'Kabou a buggé' }
            }
          },
        }),
        resurrect_seed_topic: tool({
          description: "Propose 2 ou 3 Sujets laissés en Graine ou en Archive qui pourraient être repris aujourd'hui, avec pour chacun un angle frais. Utilise cet outil quand l'entrepreneur est en panne d'inspiration et qu'il a déjà un historique de sujets — évite de l'utiliser s'il vient tout juste de démarrer.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const API = process.env.API_URL ?? 'http://localhost:3001'
              const res = await fetch(`${API}/api/ai/unstuck/resurrect-seed`, {
                method: 'POST',
                headers: { 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
              })
              if (!res.ok) return { success: false, error: await res.text() }
              return { success: true, mode: 'resurrect_seed' as const, ...(await res.json()) }
            } catch (err: any) {
              return { success: false, error: err?.message ?? 'Kabou a buggé' }
            }
          },
        }),
        propose_forgotten_domain: tool({
          description: "Détecte un domaine éditorial que l'entrepreneur n'a plus traité depuis 3+ semaines et propose 2-3 angles originaux pour le revisiter. Utile quand il tourne en rond sur les mêmes sujets — à utiliser si tu sens une monotonie ou sur demande explicite 'qu'est-ce que j'ai pas exploré récemment ?'.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const API = process.env.API_URL ?? 'http://localhost:3001'
              const res = await fetch(`${API}/api/ai/unstuck/forgotten-domain`, {
                method: 'POST',
                headers: { 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
              })
              if (!res.ok) return { success: false, error: await res.text() }
              return { success: true, mode: 'forgotten_domain' as const, ...(await res.json()) }
            } catch (err: any) {
              return { success: false, error: err?.message ?? 'Kabou a buggé' }
            }
          },
        }),
        react_to_industry_news: tool({
          description: "Cherche l'actualité récente du secteur de l'entrepreneur (7 derniers jours via webSearch) et propose 1-3 articles avec des angles de réaction. Utile quand l'entrepreneur veut 'surfer' sur une actu sans savoir laquelle. Ne l'utilise pas s'il a déjà un sujet en tête.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const API = process.env.API_URL ?? 'http://localhost:3001'
              const res = await fetch(`${API}/api/ai/unstuck/industry-news`, {
                method: 'POST',
                headers: { 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
              })
              if (!res.ok) return { success: false, error: await res.text() }
              return { success: true, mode: 'industry_news' as const, ...(await res.json()) }
            } catch (err: any) {
              return { success: false, error: err?.message ?? 'Kabou a buggé' }
            }
          },
        }),
        propose_editorial_plan: tool({
          description: "Prépare une proposition de Vision éditoriale dialoguée : une collection de 4 à 12 Sujets avec un fil rouge narratif. Ne persiste rien — retourne une preview que l'entrepreneur va sculpter (garder / reformuler / retirer) avant de valider. Utilise cet outil au lieu de generate_calendar quand tu co-construis un plan avec l'entrepreneur, surtout s'il a exprimé une intention (fil rouge, domaine, angle) ou qu'il a déjà des sujets en maturation qu'il faut respecter.",
          inputSchema: z.object({
            intentionSummary: z.string().optional().describe("Reformulation synthétique de l'intention de l'entrepreneur (fil rouge, période, pourquoi)"),
            weeksCount: z.number().optional().default(4).describe('Nombre de semaines à couvrir (max 8)'),
            videosPerWeek: z.number().optional().default(2).describe('Vidéos par semaine (max 7)'),
            platforms: z.array(z.string()).optional().describe("Plateformes cibles. Par défaut [linkedin]."),
            keepExistingTopics: z.boolean().optional().default(true).describe("Si vrai, respecte les Sujets déjà en maturation et ne les doublonne pas."),
          }),
          execute: async (input: {
            intentionSummary?: string
            weeksCount?: number
            videosPerWeek?: number
            platforms?: string[]
            keepExistingTopics?: boolean
          }) => {
            try {
              const API = process.env.API_URL ?? 'http://localhost:3001'
              const res = await fetch(`${API}/api/ai/editorial-plan/propose`, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'x-admin-secret': process.env.ADMIN_SECRET ?? '',
                  'x-organization-id': orgId,
                },
                body: JSON.stringify({
                  intentionSummary: input.intentionSummary,
                  weeksCount: input.weeksCount ?? 4,
                  videosPerWeek: input.videosPerWeek ?? 2,
                  platforms: input.platforms ?? ['linkedin'],
                  keepExistingTopics: input.keepExistingTopics ?? true,
                }),
              })
              if (!res.ok) return { success: false, error: await res.text() }
              const plan = await res.json()
              return {
                success: true,
                status: 'preview' as const,
                narrativeArc: plan.narrativeArc,
                intentionCaptured: plan.intentionCaptured,
                proposals: plan.proposals,
              }
            } catch (err: any) {
              return { success: false, error: err?.message ?? "Kabou n'a pas réussi cette fois" }
            }
          },
        }),
        commit_editorial_plan: tool({
          description: "Persiste une sélection de propositions de Vision éditoriale après validation par l'entrepreneur. Chaque proposition devient un Sujet (état Graine) + une entrée de calendrier liée, en transaction. À appeler UNIQUEMENT après que l'entrepreneur a explicitement validé la sélection.",
          inputSchema: z.object({
            proposals: z.array(
              z.object({
                suggestedDate: z.string().describe('Date YYYY-MM-DD'),
                format: z.enum(['QUESTION_BOX', 'TELEPROMPTER', 'HOT_TAKE', 'STORYTELLING', 'DAILY_TIP', 'MYTH_VS_REALITY']),
                title: z.string(),
                angle: z.string(),
                hook: z.string(),
                pillar: z.string().optional().nullable(),
                platforms: z.array(z.string()).optional(),
              }),
            ).min(1).max(12),
          }),
          execute: async ({ proposals }: { proposals: any[] }) => {
            try {
              const API = process.env.API_URL ?? 'http://localhost:3001'
              const res = await fetch(`${API}/api/ai/editorial-plan/commit`, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'x-admin-secret': process.env.ADMIN_SECRET ?? '',
                  'x-organization-id': orgId,
                },
                body: JSON.stringify({ proposals }),
              })
              if (!res.ok) return { success: false, error: await res.text() }
              const data = await res.json()
              return {
                success: true,
                status: 'committed' as const,
                committed: data.committed,
                items: data.items,
              }
            } catch (err: any) {
              return { success: false, error: err?.message ?? 'Enregistrement impossible' }
            }
          },
        }),
        analyze_recording: tool({
          description: "Regarde avec l'entrepreneur ce qui est sorti de son tournage : un résumé, ce qui a bien marché, et 0 à 2 pistes pour aller plus loin. À utiliser quand l'entrepreneur demande ton avis sur un tournage qu'il vient de faire OU quand il veut une analyse fraîche. Renvoie l'analyse persistée si elle existe déjà, sinon relance l'analyse en arrière-plan.",
          inputSchema: z.object({
            sessionId: z.string().describe("ID du tournage (Session) à analyser"),
            regenerate: z.boolean().optional().describe("Force une nouvelle analyse même si une existe déjà"),
          }),
          execute: async ({ sessionId, regenerate }: { sessionId: string; regenerate?: boolean }) => {
            try {
              // Verify the session belongs to this org before reading/ triggering anything
              const session = await prisma.session.findFirst({
                where: { id: sessionId, theme: { organizationId: orgId } },
                select: { id: true },
              })
              if (!session) return { success: false, error: 'Tournage introuvable' }

              if (regenerate) {
                const API = process.env.API_URL ?? 'http://localhost:3001'
                await fetch(`${API}/api/sessions/${sessionId}/analysis/regenerate`, {
                  method: 'POST',
                  headers: {
                    'x-admin-secret': process.env.ADMIN_SECRET ?? '',
                    'x-organization-id': orgId,
                  },
                }).catch(() => {})
              }

              const existing = await prisma.recordingAnalysis.findUnique({ where: { sessionId } })

              if (!existing || existing.status === 'PENDING') {
                return {
                  success: true,
                  status: 'pending',
                  message: "L'analyse tourne en arrière-plan — on peut la regarder ensemble dans 30 secondes, ou tu veux un lien direct vers l'écran d'après-tournage ?",
                  afterRecordingUrl: `/sujets/${sessionId}/apres-tournage`,
                }
              }

              if (existing.status === 'FAILED') {
                return {
                  success: true,
                  status: 'failed',
                  message: "Je n'ai pas réussi à analyser ce tournage cette fois. Tu veux qu'on réessaye ?",
                  afterRecordingUrl: `/sujets/${sessionId}/apres-tournage`,
                }
              }

              return {
                success: true,
                status: 'ready',
                summary: existing.summary,
                standoutMoment: existing.standoutMoment,
                strengths: existing.strengths,
                improvementPaths: existing.improvementPaths,
                afterRecordingUrl: `/sujets/${sessionId}/apres-tournage`,
              }
            } catch (err: any) {
              return { success: false, error: err?.message ?? "Souci lors de l'analyse" }
            }
          },
        }),
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (err: any) {
    console.error('Chat API error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
