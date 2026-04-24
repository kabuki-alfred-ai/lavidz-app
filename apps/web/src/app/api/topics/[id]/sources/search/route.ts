export const runtime = 'nodejs'
export const maxDuration = 60

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'
import { recordSubjectEvent } from '@/lib/subject-events'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const body = await req.json().catch(() => null)
    const query = typeof body?.query === 'string' ? body.query.trim() : ''
    if (!query) return new Response('query requise', { status: 400 })

    const res = await fetch(apiUrl(`/ai/sources/${id}/search`), {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    const payload = (await res.json()) as { sources?: unknown[] }
    await recordSubjectEvent({
      topicId: id,
      type: 'sources_searched',
      actor: 'kabou',
      metadata: {
        query,
        resultCount: Array.isArray(payload.sources) ? payload.sources.length : 0,
      },
    })
    return Response.json(payload)
  } catch (err) {
    console.error('[sources search]', err)
    return new Response('Recherche indisponible', { status: 500 })
  }
}
