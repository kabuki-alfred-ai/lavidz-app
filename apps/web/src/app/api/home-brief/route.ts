export const runtime = 'nodejs'

import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { getAuthHeaders, apiUrl, unauthorized } from '@/lib/api-proxy'
import { getSessionUser } from '@/lib/auth'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
})

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    // Fetch in parallel: upcoming calendar entries, recent sessions, AI profile
    const now = new Date()
    const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const calFrom = now.toISOString().slice(0, 10)
    const calTo = inOneWeek.toISOString().slice(0, 10)

    const [calRes, sessionsRes, profileRes] = await Promise.all([
      fetch(apiUrl(`/content-calendar?from=${calFrom}&to=${calTo}`), { headers: auth.headers }).catch(() => null),
      fetch(apiUrl('/sessions?status=DONE&limit=3&sort=updatedAt:desc'), { headers: auth.headers }).catch(() => null),
      fetch(apiUrl('/ai/profile'), { headers: auth.headers }).catch(() => null),
    ])

    // Parse calendar - next planned session
    let nextSession: { title: string; date: string; format: string; questionCount: number } | null = null
    if (calRes?.ok) {
      try {
        const calData = await calRes.json()
        const entries = Array.isArray(calData) ? calData : calData.data ?? []
        const upcoming = entries
          .filter((e: any) => new Date(e.scheduledDate) >= now)
          .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
        if (upcoming.length > 0) {
          const next = upcoming[0]
          nextSession = {
            title: next.title || next.topic || 'Session planifiee',
            date: next.scheduledDate,
            format: next.contentFormat || 'QUESTION_BOX',
            questionCount: next.questionCount ?? 5,
          }
        }
      } catch { /* */ }
    }

    // Parse recent completed sessions
    let lastVideo: { title: string; date: string; status: string } | null = null
    if (sessionsRes?.ok) {
      try {
        const sessData = await sessionsRes.json()
        const sessions = Array.isArray(sessData) ? sessData : sessData.data ?? []
        if (sessions.length > 0) {
          const last = sessions[0]
          lastVideo = {
            title: last.theme?.name || last.themeTitle || 'Video',
            date: last.submittedAt || last.updatedAt || last.createdAt,
            status: last.status,
          }
        }
      } catch { /* */ }
    }

    // Parse AI profile for suggestions
    let suggestions: { title: string; format: string; reason: string }[] = []
    let hasProfile = false
    let profileData: any = null
    if (profileRes?.ok) {
      try {
        profileData = await profileRes.json()
        hasProfile = !!(profileData?.businessContext?.summary || profileData?.editorialPillars?.length)

        const pillars: string[] = profileData?.editorialPillars ?? []
        const topicsExplored: string[] = profileData?.topicsExplored ?? []

        // Generate simple suggestions based on pillars not yet filmed
        const unexplored = pillars.filter((p: string) => !topicsExplored.some((t: string) => t.toLowerCase().includes(p.toLowerCase())))

        if (unexplored.length > 0) {
          suggestions.push({
            title: unexplored[0],
            format: 'QUESTION_BOX',
            reason: 'Pilier editorial pas encore filme',
          })
        }

        // Always suggest a storytelling if they have memories
        if (profileData?.businessContext?.summary) {
          suggestions.push({
            title: 'Raconte ton parcours',
            format: 'STORYTELLING',
            reason: 'Les videos storytelling performent 3x mieux',
          })
        }

        // Suggest a hot take
        suggestions.push({
          title: 'Reagis a un sujet de ton secteur',
          format: 'HOT_TAKE',
          reason: 'Format court ideal pour la visibilite',
        })
      } catch { /* */ }
    }

    // Fetch trending topics via Tavily based on user's sector
    let trends: { title: string; url: string; snippet: string }[] = []
    let trendsRecap: string | null = null
    const tavilyKey = process.env.TAVILY_API_KEY ?? ''
    if (tavilyKey && hasProfile && profileData) {
      try {
        const summary = profileData.businessContext?.summary as { activite?: string } | undefined
        const activite = summary?.activite ?? ''
        const pillars: string[] = profileData.editorialPillars ?? []
        const sector = activite || pillars.join(', ') || ''

        if (sector) {
          const trendRes = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tavilyKey}`,
            },
            body: JSON.stringify({
              query: `actualites et tendances du jour en France dans le domaine : ${sector}`,
              search_depth: 'advanced',
              include_answer: false,
              max_results: 5,
              topic: 'news',
            }),
          })
          if (trendRes.ok) {
            const trendData = await trendRes.json() as { results?: { title: string; url: string; content: string }[] }
            const results = trendData.results ?? []
            trends = results.map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.content.slice(0, 150),
            }))

            // Generate French recap via Gemini
            if (results.length > 0) {
              try {
                const rawContent = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`).join('\n\n')
                const { text } = await generateText({
                  model: google(process.env.AI_MODEL ?? 'gemini-2.5-flash'),
                  prompt: `Tu es un assistant pour un entrepreneur dont l'activite est : "${sector}".
Voici des articles d'actualite trouves aujourd'hui :

${rawContent}

Redige un recap de 2-3 phrases en francais, synthetique et utile pour cet entrepreneur.
Mets en avant ce qui est pertinent pour son activite et ce qu'il pourrait utiliser comme idee de contenu video.
Ne cite pas les sources, sois direct et naturel. Reponds UNIQUEMENT le recap, rien d'autre.`,
                })
                trendsRecap = text.trim()
              } catch { /* fallback: no recap */ }
            }
          }
        }
      } catch {
        // Non-blocking
      }
    }

    return Response.json({
      userName: user.firstName || user.email.split('@')[0],
      nextSession,
      lastVideo,
      suggestions: suggestions.slice(0, 3),
      trends,
      trendsRecap,
      hasProfile,
    })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
