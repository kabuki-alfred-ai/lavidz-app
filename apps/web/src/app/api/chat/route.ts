import { streamText, convertToModelMessages, tool, stepCountIs } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { KABOU_SYSTEM_PREAMBLE } from '@/lib/kabou-voice'
import { recordSubjectEvent } from '@/lib/subject-events'

/**
 * Map entre le nom d'un tool Kabou et la signature d'event à écrire dans
 * SubjectEvent. Permet au fil du sujet (§05) d'afficher « Kabou a enrichi
 * tes piliers », « Kabou a posé l'angle », etc. avec un libellé lisible.
 * Les tools non-mutants ou qui ne ciblent pas un topic ne sont pas ici.
 */
const KABOU_TOOL_EVENT: Record<string, { type: string; label?: string }> = {
  create_topic: { type: 'topic_created', label: "Kabou a proposé le sujet" },
  update_topic_brief: { type: 'brief_edited', label: "Kabou a retravaillé l'angle" },
  mark_topic_ready: { type: 'status_changed', label: 'Kabou a marqué le sujet prêt' },
  update_narrative_anchor: { type: 'narrative_anchor_edited', label: 'Kabou a enrichi les piliers' },
  update_recording_guide_draft: { type: 'narrative_anchor_edited', label: 'Kabou a enrichi les piliers' },
  reshape_to_recording_script: { type: 'kabou_enriched', label: 'Kabou a reshape le script' },
  reshape_recording_guide_to_format: { type: 'kabou_enriched', label: 'Kabou a reshape le script' },
  create_recording_session: { type: 'session_created', label: 'Kabou a préparé un tournage' },
  commit_editorial_plan: { type: 'schedule_published', label: 'Kabou a calé le plan éditorial' },
  propose_kabou: { type: 'kabou_proposal', label: 'Kabou a proposé une vidéo' },
  propose_linkedin_video: { type: 'linkedin_proposal', label: 'Kabou a proposé une vidéo LinkedIn' },
}

export const runtime = 'nodejs'
export const maxDuration = 60

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
})

/**
 * Dual-write Topic.narrativeAnchor (nouvelle source de vérité) + Topic.recordingGuide
 * (legacy) — factorise la logique des tools `update_narrative_anchor` (nouveau)
 * et `update_recording_guide_draft` (alias legacy, F2+F9).
 */
async function writeNarrativeAnchor(
  topicId: string,
  bullets: string[],
  existingRecordingGuide: unknown,
  orgId: string,
): Promise<{ success: true; bulletsCount: number } | { success: false; error: string }> {
  try {
    const cleaned = bullets.map((b) => b.trim()).filter((b) => b.length > 0)
    if (cleaned.length < 2) {
      return { success: false, error: 'Au moins 2 bullets non vides requis' }
    }
    // On préserve sourceDraft si présent sur le recordingGuide legacy
    // pour ne pas perdre la trace d'un reshape éventuel côté ancienne archi.
    const legacyExisting = existingRecordingGuide as Record<string, unknown> | null
    const sourceDraft =
      legacyExisting && typeof legacyExisting === 'object' && legacyExisting.sourceDraft
        ? legacyExisting.sourceDraft
        : undefined
    const legacyPayload = {
      kind: 'draft' as const,
      bullets: cleaned,
      ...(sourceDraft ? { sourceDraft } : {}),
    }
    const newPayload = {
      kind: 'draft' as const,
      bullets: cleaned,
    }
    const API = process.env.API_URL ?? 'http://localhost:3001'
    const res = await fetch(`${API}/api/ai/topics/${topicId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': process.env.ADMIN_SECRET ?? '',
        'x-organization-id': orgId,
      },
      body: JSON.stringify({
        recordingGuide: legacyPayload, // F9 dual-write legacy
        narrativeAnchor: newPayload, // F3 nouvelle source de vérité
      }),
    })
    if (!res.ok) return { success: false, error: await res.text() }
    return { success: true, bulletsCount: cleaned.length }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur' }
  }
}

/**
 * Déclenche le reshape de Topic.narrativeAnchor vers Session.recordingScript
 * format-specific côté backend (qui gère RAG + écriture). Task 2.5.
 */
async function reshapeSessionScript(
  sessionId: string,
  format: string,
  orgId: string,
): Promise<{ success: true; format: string; kind?: string } | { success: false; error: string }> {
  try {
    const API = process.env.API_URL ?? 'http://localhost:3001'
    const res = await fetch(`${API}/api/ai/sessions/${sessionId}/recording-script/reshape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': process.env.ADMIN_SECRET ?? '',
        'x-organization-id': orgId,
      },
      body: JSON.stringify({ format }),
    })
    if (!res.ok) return { success: false, error: await res.text() }
    const data = await res.json()
    return {
      success: true,
      format,
      kind: (data?.recordingScript as { kind?: string } | undefined)?.kind,
    }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur' }
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
      ? user.activeOrgId
      : user.organizationId
    if (!orgId) return new Response('No organization', { status: 400 })

    const { messages, threadId, topicId, currentSessionId, currentFormat, context, selectedFormat, pendingSubject } = await req.json()
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
    let currentTopic: {
      id: string
      name: string
      brief: string | null
      status: string
      pillar: string | null
      threadId: string
      recordingGuide: unknown
      hooks: unknown
      sources: unknown
    } | null = null
    if (topicId) {
      try {
        currentTopic = await prisma.topic.findFirst({
          where: { id: topicId, organizationId: orgId },
          select: {
            id: true,
            name: true,
            brief: true,
            status: true,
            pillar: true,
            threadId: true,
            recordingGuide: true,
            hooks: true,
            sources: true,
          },
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
        // RAG scope topicId-aware : si on est sur un Topic, on privilégie ses memories
        // (sinon fallback profile-wide via le param `scope`)
        const ragUrl = topicId
          ? `${API}/api/ai/memories/search?q=${encodeURIComponent(lastText)}&k=5&topicId=${encodeURIComponent(String(topicId))}`
          : `${API}/api/ai/memories/search?q=${encodeURIComponent(lastText)}&k=5`
        const ragRes = await fetch(ragUrl, {
          headers: { 'x-admin-secret': process.env.ADMIN_SECRET ?? '', 'x-organization-id': orgId },
        })
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

    if (context === 'opening') {
      systemParts.push(`
## MODE OUVERTURE — Coach éditorial

Tu es un coach éditorial. Ton rôle : creuser le sujet avec l'entrepreneur pour en extraire LA matière brute d'une vraie vidéo. Tu appelles propose_kabou() seulement quand tu as assez de substance — jamais avant 3 échanges réels.

### Phase 1 — Comprendre le sujet (messages 1-2)
- Reformule le sujet tel que tu l'entends, en 1 phrase percutante.
- Pose UNE seule question ouverte pour trouver l'ANGLE : "C'est quoi ton point de vue là-dessus ?" / "Tu défends quoi exactement ?" / "Tu parles de quelle situation concrète ?"
- Réponse courte : 2-3 lignes max. Pas de liste.

### Phase 2 — Extraire la substance (messages 3-5)
Selon ce qu'il répond, creuse une des pistes suivantes (PAS toutes à la fois) :
- **L'histoire concrète** : "Tu as un exemple précis qui t'a fait réaliser ça ?"
- **L'ennemi** : "C'est quoi l'idée reçue que tu veux démolir ?"
- **Le truc contre-intuitif** : "Qu'est-ce que la plupart des gens font de travers sur ce sujet ?"
- **La transformation** : "Qu'est-ce qui change concrètement pour quelqu'un qui applique ça ?"

Challenge ce qui est trop vague : "C'est encore large — t'as un moment précis où t'as vécu ça ?" Ne valide pas une idée faible, pointe ce qui manque.

### Phase 3 — Confirmer puis proposer (après 3+ échanges substantiels)
Quand tu as : un angle clair + au moins un élément concret (histoire, exemple, chiffre, conviction forte)
→ Dis en 1 phrase : "Ok, j'ai ce qu'il me faut — je te prépare le script ?"
→ Attends la réponse de l'user. Si il confirme (oui, go, ouais, ok, vas-y…) alors APPELLE propose_kabou() SANS écrire le script dans le texte.
→ Si il veut ajuster ou ajouter quelque chose, continue la conversation.

### Raccourcis — APPELLE propose_kabou() immédiatement SANS confirmation si :
- L'user dit explicitement "go", "génère", "propose", "c'est bon lance" ou équivalent
- L'user a fourni dès le départ un sujet ultra-détaillé (angle + exemple + conviction en 1 seul message dense)

### JAMAIS :
- Proposer avant 3 échanges réels sauf raccourci explicite
- Écrire un script, des bullets ou une structure dans le texte
- Poser plusieurs questions dans le même message
- Appeler propose_kabou() sans confirmation de l'user (sauf raccourci)

### Mapping pour propose_kabou() :
- Opinion forte / idée reçue à démolir / prise de position → mood: "challenger", formatKind: "reaction" ou "mythe"
- Histoire perso / victoire client / anecdote vécue      → mood: "authentique", formatKind: "histoire"
- Framework / tip / explication de mécanisme             → mood: "expert",      formatKind: "conseil" ou "interview"

beats : 3 bullets percutants style parlé, issus de la conversation. beatLabels : ["Hook", <label2>, <label3>].
coachingTip : 1 instruction filmage basée sur CE QUE L'USER A DIT (ex: "Commence par l'anecdote du client, pas l'explication.").`)
    }

    if (context === 'rework') {
      systemParts.push(`
## MODE RETRAVAIL

L'entrepreneur veut ajuster la proposition (format, ton, angle).
→ Appelle IMMÉDIATEMENT propose_kabou() avec la version corrigée. Aucun texte avant l'appel.`)
    }

    // F12 — Contexte session/format en tête pour que Kabou n'hallucine pas entre
    // deux formats quand un même thread Topic mélange plusieurs tournages.
    if (currentSessionId || currentFormat) {
      const ctxBits: string[] = []
      if (currentSessionId) ctxBits.push(`session ${currentSessionId}`)
      if (currentFormat) ctxBits.push(`format ${currentFormat}`)
      systemParts.push(`\n[Context: ${ctxBits.join(', ')}]`)
    }

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

      // Accroche — deux variantes générées (native vs marketing), potentiellement une choisie.
      // Kabou doit pouvoir la référencer, proposer de la reformuler, ou tisser la suite autour.
      const hooks = currentTopic.hooks as {
        native?: { phrase?: string; rationale?: string }
        marketing?: { phrase?: string; rationale?: string }
        chosen?: 'native' | 'marketing' | null
      } | null
      if (hooks && typeof hooks === 'object') {
        const nativePhrase = typeof hooks.native?.phrase === 'string' ? hooks.native.phrase : null
        const marketingPhrase = typeof hooks.marketing?.phrase === 'string' ? hooks.marketing.phrase : null
        const chosen = hooks.chosen === 'native' || hooks.chosen === 'marketing' ? hooks.chosen : null
        if (nativePhrase || marketingPhrase) {
          const lines = ['\nAccroches générées pour ce sujet :']
          if (nativePhrase) lines.push(`- Ta voix : "${nativePhrase}"`)
          if (marketingPhrase) lines.push(`- Version scroll : "${marketingPhrase}"`)
          if (chosen) {
            const chosenPhrase = chosen === 'native' ? nativePhrase : marketingPhrase
            if (chosenPhrase) lines.push(`Accroche choisie par l'entrepreneur : "${chosenPhrase}" (${chosen === 'native' ? 'version native' : 'version scroll'}).`)
          } else {
            lines.push(`Aucune n'est encore choisie — tu peux aider à trancher ou proposer une troisième voie si pertinent.`)
          }
          topicLines.push(lines.join('\n'))
        }
      }

      // Sources — ancrages factuels. On n'injecte QUE les sources sélectionnées
      // (pinnées par l'entrepreneur). Les candidates trouvées par Tavily/Kabou
      // mais pas encore choisies ne polluent pas le contexte — l'user garde la
      // main sur ce qui entre en mémoire IA.
      const sourcesRaw = currentTopic.sources as {
        sources?: Array<{
          title?: string
          url?: string
          summary?: string
          relevance?: string
          keyTakeaway?: string
          selected?: boolean
        }>
      } | null
      const selectedSources = Array.isArray(sourcesRaw?.sources)
        ? sourcesRaw!.sources!.filter((s) => s.selected !== false)
        : []
      if (selectedSources.length > 0) {
        const lines = ['\nSources ancrées sur ce sujet (utilise-les pour muscler l\'angle, proposer un fait ou un contre-angle) :']
        selectedSources.slice(0, 8).forEach((s, i) => {
          const title = typeof s.title === 'string' ? s.title : 'Source'
          const relevance = typeof s.relevance === 'string' ? ` [${s.relevance}]` : ''
          const takeaway = typeof s.keyTakeaway === 'string' && s.keyTakeaway.trim().length > 0
            ? s.keyTakeaway.trim()
            : (typeof s.summary === 'string' ? s.summary.trim() : '')
          lines.push(`${i + 1}. ${title}${relevance} — ${takeaway}`)
        })
        lines.push(`Référence ces sources naturellement dans la conversation, sans les réciter brutalement. Elles nourrissent la solidité factuelle, pas la diction.`)
        topicLines.push(lines.join('\n'))
      }

      // Fil conducteur d'enregistrement — draft enrichi au fil des échanges
      const guide = currentTopic.recordingGuide as { kind?: string; bullets?: unknown[] } | null
      if (guide && typeof guide === 'object') {
        if (guide.kind === 'draft' && Array.isArray(guide.bullets)) {
          const bullets = (guide.bullets as unknown[])
            .filter((b): b is string => typeof b === 'string')
            .map((b) => `  - ${b}`)
            .join('\n')
          topicLines.push(`\nFil conducteur d'enregistrement actuel (ébauche) :\n${bullets}`)
          topicLines.push(
            `Quand un point clé ressort de la discussion, enrichis ce fil en appelant update_recording_guide_draft avec la liste complète mise à jour (3-5 bullets max, concises). Ne lance pas le tool après chaque message — attends qu'un vrai point structurant émerge.`,
          )
        } else {
          topicLines.push(
            `\nCe sujet a déjà un fil conducteur reformatté (kind: ${guide.kind}). Ne l'écrase pas sans demander — si l'entrepreneur veut repartir d'un draft, propose-lui d'abord de repasser sur les bullets.`,
          )
        }
      } else {
        topicLines.push(
          `\nCe sujet n'a pas encore de fil conducteur d'enregistrement. Quand 3+ points structurants ont émergé de vos échanges (angle, anecdote, conseil, idée reçue à combattre), appelle update_recording_guide_draft pour poser 3-5 bullets qui guideront le tournage.`,
        )
      }

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

    // Recording instructions — uniquement hors du contexte home/rework
    // où le flow est géré par l'UI (propose_kabou → boutons UI → /api/sessions direct)
    if (context !== 'opening' && context !== 'rework') {
      systemParts.push(`\nENREGISTREMENT VIDEO :
Quand l'utilisateur veut enregistrer une video :
- Si le message contient deja un sujet ET un format precis (ex: "Je veux enregistrer la video X (format: STORYTELLING)"), appelle DIRECTEMENT create_recording_session sans poser de questions supplementaires. Genere les questions/script toi-meme et cree la session.
- Sinon, prepare les questions, presente-les et demande validation avant d'appeler create_recording_session.

Formats et leurs donnees :
- QUESTION_BOX / STORYTELLING / MYTH_VS_REALITY → passe des questions avec hints
- TELEPROMPTER → passe un teleprompterScript structure en POINTS CLES. Format : sections [HOOK], [CONTENU], [CTA] avec des bullet points concis
- HOT_TAKE / DAILY_TIP → passe 1-3 points de guidage comme questions`)
    }

    // In home flow (opening/rework), expose ONLY propose_kabou.
    // All other tools are noise that cause the LLM to call the wrong thing.
    // Mission/onboarding blocks are also excluded — MODE OUVERTURE is self-contained.
    const isHomeFlow = context === 'opening' || context === 'rework'

    if (!isHomeFlow) {
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
    }

    const modelMessages = await convertToModelMessages(messages)
    const tavilyKey = process.env.TAVILY_API_KEY ?? ''

    if (!isHomeFlow && tavilyKey) {
      systemParts.push(`\nRECHERCHE WEB :
Tu as acces a un outil de recherche web (webSearch). Utilise-le quand c'est pertinent :
- Quand l'utilisateur pose une question factuelle
- Pour chercher des tendances, actualites ou idees de contenu
- Pour trouver des infos sur un sujet specifique
- Integre les resultats naturellement dans ta reponse`)
    }

    const result = streamText({
      model: isHomeFlow ? google('gemini-2.5-pro') : google('gemini-2.5-flash'),
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

        // Fil du sujet — chaque tool Kabou qui mute un Topic laisse une trace.
        // On ne se fie pas au topicId du request (il peut dériver vers un autre
        // sujet au fil des tools) : on lit le topicId DANS l'input du tool.
        if (toolCalls?.length) {
          for (const call of toolCalls) {
            if (!call) continue
            const meta = KABOU_TOOL_EVENT[call.toolName]
            if (!meta) continue
            const input = call.input as Record<string, unknown> | undefined
            const tid =
              typeof input?.topicId === 'string' ? input.topicId : topicId ?? null
            if (!tid) continue
            await recordSubjectEvent({
              topicId: tid,
              type: meta.type,
              actor: 'kabou',
              metadata: {
                tool: call.toolName,
                label: meta.label,
              },
            })
          }
        }
      },
      tools: {
        // ── Home flow ──────────────────────────────────────────────────────────
        // Only propose_kabou is needed — all other tools are excluded to prevent
        // the LLM from calling propose_linkedin_video or unrelated tools.
        propose_kabou: tool({
          description: "Propose une vidéo complète après avoir compris le sujet : format choisi, script de poche (3 beats), coaching tip. Appeler dès qu'on a compris le sujet (1-2 échanges max). Peut être rappelé pour retravail.",
          inputSchema: z.object({
            sujet: z.string().describe("Le sujet formulé comme titre accrocheur court"),
            mood: z.enum(['challenger', 'authentique', 'expert']),
            moodLabel: z.string().describe('ex: "❤️ Authentique"'),
            contentFormat: z.enum(['QUESTION_BOX', 'TELEPROMPTER', 'HOT_TAKE', 'STORYTELLING', 'DAILY_TIP', 'MYTH_VS_REALITY']).describe("Format technique à utiliser pour la session"),
            formatKind: z.enum(['histoire', 'reaction', 'interview', 'conseil', 'mythe', 'guide']).describe("Catégorie visuelle : histoire=STORYTELLING, reaction=HOT_TAKE, interview=QUESTION_BOX, conseil=DAILY_TIP, mythe=MYTH_VS_REALITY, guide=TELEPROMPTER"),
            duration: z.string().describe('ex: "~75 sec"'),
            beatLabels: z.array(z.string()).length(3).describe('Labels des 3 beats, ex: ["Hook", "Le truc tout con", "Le résultat"]'),
            beats: z.array(z.string()).length(3).describe("3 bullets courts du script de poche — percutants, en style parlé"),
            coachingTip: z.string().describe("1 instruction concrète sur comment commencer le tournage"),
          }),
          execute: async (args) => ({ ...args, status: 'pending_validation' }),
        }),

        // ── Full tools — excluded in home flow ─────────────────────────────────
        ...(isHomeFlow ? {} : {

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
          // Task 2.4 — update_narrative_anchor : écriture sur Topic.narrativeAnchor
          // (NOUVELLE source de vérité stratégique, F3). Le controller accepte
          // simultanément recordingGuide pour préserver le dual-write (F9).
          update_narrative_anchor: tool({
            description: `Met à jour l'ancre narrative stratégique du Sujet courant (bullets de fond qui résistent aux formats). À appeler quand 3+ points structurants ont émergé de la conversation — angle, anecdote, idée reçue à combattre, conseil actionnable. Passe toujours la liste COMPLÈTE mise à jour (3-5 bullets max, chacune ≤ 20 mots). Cette ancre alimente ensuite les scripts format-specific via reshape_to_recording_script.`,
            inputSchema: z.object({
              bullets: z
                .array(z.string())
                .min(2)
                .max(6)
                .describe("Liste complète des bullets de l'ancre narrative (3-5 idéalement, concises)"),
            }),
            execute: async ({ bullets }: { bullets: string[] }) =>
              writeNarrativeAnchor(currentTopic!.id, bullets, currentTopic!.recordingGuide, orgId),
          }),
          // LEGACY alias — dual-entry pendant 1 sprint pour ne pas casser les
          // threads Kabou qui référencent encore l'ancien nom (F2). Même logique
          // interne : dual-write Topic.narrativeAnchor + Topic.recordingGuide.
          update_recording_guide_draft: tool({
            description: `[LEGACY — utilise update_narrative_anchor à la place] Met à jour le fil conducteur d'enregistrement (ébauche) du Sujet courant.`,
            inputSchema: z.object({
              bullets: z.array(z.string()).min(2).max(6).describe('Liste complète des bullets (3-5 idéalement)'),
            }),
            execute: async ({ bullets }: { bullets: string[] }) =>
              writeNarrativeAnchor(currentTopic!.id, bullets, currentTopic!.recordingGuide, orgId),
          }),
          // Task 2.5 — reshape_to_recording_script : écriture sur Session.recordingScript
          // format-specific depuis Topic.narrativeAnchor + RAG topic-scoped (côté backend).
          reshape_to_recording_script: tool({
            description: `Reformate l'ancre narrative du Sujet vers un script format-specific (mythe/réalité, Q/R, storytelling, prise de position, conseil du jour, téléprompteur) pour UNE SESSION précise. À appeler UNIQUEMENT après validation explicite de l'entrepreneur. Nécessite un sessionId — si le contexte de la conversation porte déjà une session active, l'utiliser.`,
            inputSchema: z.object({
              sessionId: z.string().describe('ID de la session cible dont le recordingScript doit être généré'),
              format: z
                .enum(['MYTH_VS_REALITY', 'QUESTION_BOX', 'STORYTELLING', 'HOT_TAKE', 'DAILY_TIP', 'TELEPROMPTER'])
                .describe('Format cible — doit correspondre au contentFormat de la session'),
            }),
            execute: async ({ sessionId, format }: { sessionId: string; format: string }) =>
              reshapeSessionScript(sessionId, format, orgId),
          }),
          // LEGACY alias — pour les threads qui référencent encore l'ancien nom.
          // Si currentSessionId est présent (utilisateur sur /s/[id]), on bascule
          // vers le flux Session. Sinon fallback legacy Topic.recordingGuide.
          reshape_recording_guide_to_format: tool({
            description: `[LEGACY — utilise reshape_to_recording_script] Reformate le fil conducteur vers un format précis.`,
            inputSchema: z.object({
              format: z
                .enum(['MYTH_VS_REALITY', 'QUESTION_BOX', 'STORYTELLING', 'HOT_TAKE', 'DAILY_TIP', 'TELEPROMPTER'])
                .describe('Format cible'),
            }),
            execute: async ({ format }: { format: string }) => {
              if (currentSessionId) {
                return reshapeSessionScript(currentSessionId as string, format, orgId)
              }
              // Fallback legacy : reshape Topic.recordingGuide (ancienne architecture)
              try {
                const API = process.env.API_URL ?? 'http://localhost:3001'
                const res = await fetch(
                  `${API}/api/ai/topics/${currentTopic!.id}/recording-guide/reshape`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-admin-secret': process.env.ADMIN_SECRET ?? '',
                      'x-organization-id': orgId,
                    },
                    body: JSON.stringify({ format }),
                  },
                )
                if (!res.ok) return { success: false, error: await res.text() }
                const data = await res.json()
                return { success: true, format, kind: (data.recordingGuide as { kind?: string })?.kind }
              } catch (err: any) {
                return { success: false, error: err?.message ?? 'Erreur' }
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
        ...(context !== 'opening' && context !== 'rework' ? { create_recording_session: {
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
        } } : {}),
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
        propose_linkedin_video: tool({
          description: "Propose une vidéo LinkedIn après avoir détecté le mood depuis la conversation d'ouverture. Appeler dès qu'on a assez de contexte (1-2 échanges max).",
          inputSchema: z.object({
            mood: z.enum(['challenger', 'authentique', 'expert']),
            moodLabel: z.string().describe('ex: "🔥 Challenger"'),
            sujet: z.string().describe('Le sujet formulé comme titre de vidéo LinkedIn accrocheur'),
            format: z.enum(['opinion_courte', 'story', 'expertise', 'thought_leadership']),
            formatLabel: z.string().describe('ex: "Opinion courte"'),
            formatDuration: z.string().describe('ex: "45 secondes"'),
            coachingTip: z.string().describe('1 instruction coaching pré-tournage'),
            coachingExample: z.string().describe('Exemple concret généré depuis le sujet réel'),
            pocketScriptBullets: z.array(z.string()).length(3).describe('3 bullets pour le Script de poche'),
          }),
          execute: async (args) => ({ ...args, status: 'pending_validation' }),
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

        }), // end isHomeFlow ? {} : { ... }
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (err: any) {
    console.error('Chat API error:', err)
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
