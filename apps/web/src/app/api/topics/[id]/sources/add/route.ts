export const runtime = 'nodejs'

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
    if (!body?.title?.trim() || !body?.url?.trim()) {
      return new Response('title et url requis', { status: 400 })
    }

    const res = await fetch(apiUrl(`/ai/sources/${id}/add`), {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    const payload = await res.json()
    await recordSubjectEvent({
      topicId: id,
      type: 'source_added',
      actor: 'user',
      metadata: {
        title: body.title,
        url: body.url,
        relevance: body.relevance ?? null,
      },
    })
    return Response.json(payload)
  } catch (err) {
    console.error('[sources add]', err)
    return new Response("Impossible d'ajouter la source", { status: 500 })
  }
}
