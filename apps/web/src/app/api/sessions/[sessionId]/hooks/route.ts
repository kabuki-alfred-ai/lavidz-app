export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized } from '@/lib/api-proxy'

/**
 * GET /api/sessions/:sessionId/hooks → Session.hooks actuel (ou null).
 * Proxy vers NestJS `/ai/sessions/:id/hooks`.
 */
export async function GET(
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

    const res = await fetch(apiUrl(`/ai/sessions/${sessionId}/hooks`), {
      headers: auth.headers,
    })
    if (!res.ok) {
      const text = await res.text()
      return new Response(text || 'Impossible de lire les accroches', { status: res.status })
    }
    return Response.json(await res.json())
  } catch (err) {
    console.error('[session hooks GET]', err)
    return new Response('Impossible de lire les accroches', { status: 500 })
  }
}
