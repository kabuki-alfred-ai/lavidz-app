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
    const url = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!url) return new Response('url requise', { status: 400 })
    const selected = typeof body?.selected === 'boolean' ? body.selected : undefined

    const res = await fetch(apiUrl(`/ai/sources/${id}/toggle`), {
      method: 'POST',
      credentials: 'include',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, selected }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    const payload = (await res.json()) as {
      sources?: Array<{ url?: string; selected?: boolean }>
    }

    // Retrouve l'état final de la source toggle pour typer l'event.
    const updated = Array.isArray(payload.sources)
      ? payload.sources.find((s) => s.url?.trim() === url)
      : undefined
    const nowSelected = updated?.selected !== false
    await recordSubjectEvent({
      topicId: id,
      type: nowSelected ? 'source_selected' : 'source_deselected',
      actor: 'user',
      metadata: { url, selected: nowSelected },
    })
    return Response.json(payload)
  } catch (err) {
    console.error('[sources toggle]', err)
    return new Response('Impossible de basculer la source', { status: 500 })
  }
}
