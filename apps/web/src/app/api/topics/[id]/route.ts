export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized, noOrg } from '@/lib/api-proxy'
import { getSessionUser } from '@/lib/auth'
import { recordSubjectEvent } from '@/lib/subject-events'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()
    const { id } = await params

    const res = await fetch(apiUrl(`/ai/topics/${id}`), { headers: auth.headers })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()
    const { id } = await params

    const body = (await req.json()) as Record<string, unknown>

    // On capture l'état AVANT mutation pour détecter les deltas (brief modifié
    // pour la première fois vs ré-édité, status from→to, etc.). Best-effort.
    let beforeStatus: string | undefined
    try {
      const before = await fetch(apiUrl(`/ai/topics/${id}`), { headers: auth.headers })
      if (before.ok) {
        const data = (await before.json()) as { status?: string }
        beforeStatus = data.status
      }
    } catch {
      /* ignore */
    }

    const res = await fetch(apiUrl(`/ai/topics/${id}`), {
      method: 'PUT',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    const updated = await res.json()

    // Fire events (best-effort, never throws to caller)
    if ('brief' in body && typeof body.brief === 'string') {
      await recordSubjectEvent({
        topicId: id,
        type: 'brief_edited',
        actor: 'user',
        metadata: { length: body.brief.length },
      })
    }
    if ('pillar' in body) {
      await recordSubjectEvent({
        topicId: id,
        type: 'pillar_changed',
        actor: 'user',
        metadata: { pillar: body.pillar ?? null },
      })
    }
    if ('status' in body && typeof body.status === 'string' && body.status !== beforeStatus) {
      await recordSubjectEvent({
        topicId: id,
        type: 'status_changed',
        actor: 'user',
        metadata: { from: beforeStatus ?? null, to: body.status },
      })
    }
    if ('narrativeAnchor' in body) {
      const anchor = body.narrativeAnchor as { bullets?: unknown[] } | null
      await recordSubjectEvent({
        topicId: id,
        type: 'narrative_anchor_edited',
        actor: 'user',
        metadata: {
          bulletsCount: Array.isArray(anchor?.bullets) ? anchor!.bullets!.length : 0,
        },
      })
    }

    return Response.json(updated)
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()
    const { id } = await params

    const res = await fetch(apiUrl(`/ai/topics/${id}`), {
      method: 'DELETE',
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
