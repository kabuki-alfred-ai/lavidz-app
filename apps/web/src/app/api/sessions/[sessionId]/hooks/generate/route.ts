export const runtime = 'nodejs'
export const maxDuration = 45

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized } from '@/lib/api-proxy'

/**
 * POST /api/sessions/:sessionId/hooks/generate → génère native + marketing
 * format-specific via session-hook.service (RAG topic-scoped, F11).
 */
export async function POST(
  _req: Request,
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

    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const res = await fetch(apiUrl(`/ai/sessions/${sessionId}/hooks/generate`), {
      method: 'POST',
      headers: auth.headers,
    })
    if (!res.ok) {
      const text = await res.text()
      return new Response(text || 'Impossible de proposer des accroches', { status: res.status })
    }
    return Response.json(await res.json())
  } catch (err) {
    console.error('[session hooks generate]', err)
    return new Response('Impossible de proposer des accroches', { status: 500 })
  }
}
