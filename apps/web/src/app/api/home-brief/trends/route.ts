export const runtime = 'nodejs'

import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { getAuthHeaders, apiUrl, unauthorized } from '@/lib/api-proxy'
import { getSessionUser } from '@/lib/auth'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
})

const ANGLES = [
  'actualites et nouveautes',
  'tendances et innovations',
  'opportunites et evolutions du marche',
  'chiffres cles et etudes recentes',
  'nouvelles reglementations et impacts',
]

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()

    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const tavilyKey = process.env.TAVILY_API_KEY ?? ''
    if (!tavilyKey) {
      return Response.json({ trends: [], trendsRecap: null })
    }

    // Fetch profile to get user's sector
    let sector = ''
    let pillars: string[] = []
    try {
      const profileRes = await fetch(apiUrl('/ai/profile'), { headers: auth.headers })
      if (profileRes.ok) {
        const profile = await profileRes.json()
        const summary = profile?.businessContext?.summary as { activite?: string } | undefined
        sector = summary?.activite ?? ''
        pillars = profile?.editorialPillars ?? []
        if (!sector) sector = pillars.join(', ')
      }
    } catch { /* */ }

    if (!sector) {
      return Response.json({ trends: [], trendsRecap: null })
    }

    // Pick a random angle to vary results on refresh
    const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)]

    const trendRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tavilyKey}`,
      },
      body: JSON.stringify({
        query: `${angle} ${sector} France ${new Date().toLocaleDateString('fr-FR')}`,
        search_depth: 'advanced',
        include_answer: false,
        max_results: 5,
        topic: 'news',
      }),
    })

    if (!trendRes.ok) {
      return Response.json({ trends: [], trendsRecap: null })
    }

    const trendData = await trendRes.json() as { results?: { title: string; url: string; content: string }[] }
    const results = trendData.results ?? []

    if (results.length === 0) {
      return Response.json({ trends: [], trendsRecap: null })
    }

    // Use Gemini to generate a French recap from the raw results
    const rawContent = results
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
      .join('\n\n')

    let trendsRecap: string | null = null
    try {
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
    } catch {
      // Fallback: no recap
    }

    return Response.json({
      trends: results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content.slice(0, 150),
      })),
      trendsRecap,
    })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
