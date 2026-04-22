export const runtime = 'nodejs'
export const maxDuration = 45

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized } from '@/lib/api-proxy'

/**
 * POST /api/sessions/:sessionId/recording-script/reshape
 *
 * Proxy vers NestJS pour reshape `Topic.narrativeAnchor` → `Session.recordingScript`
 * format-specific, enrichi RAG topic-scoped (Task 2.5). Body : `{ format }`.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getSessionUser()
    if (!user?.organizationId) return unauthorized()
    const { sessionId } = await params

    const session = await prisma.session.findFirst({
      where: { id: sessionId, theme: { organizationId: user.organizationId } },
      select: { id: true },
    })
    if (!session) return new Response('Tournage introuvable', { status: 404 })

    const body = await req.json().catch(() => null)
    if (!body?.format) return new Response('format requis', { status: 400 })

    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const res = await fetch(apiUrl(`/ai/sessions/${sessionId}/recording-script/reshape`), {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: body.format }),
    })
    if (!res.ok) {
      const text = await res.text()
      return new Response(text || 'Impossible de re-synchroniser', { status: res.status })
    }
    return Response.json(await res.json())
  } catch (err) {
    console.error('[reshape recording-script]', err)
    return new Response('Impossible de re-synchroniser', { status: 500 })
  }
}
