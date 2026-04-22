export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized } from '@/lib/api-proxy'

/**
 * Task 5.3 — POST /api/sessions/:sessionId/replace : proxy vers NestJS pour
 * marquer la session courante REPLACED et en créer une nouvelle même
 * (topicId, contentFormat) avec le recordingScript cloné.
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

    const res = await fetch(apiUrl(`/sessions/${sessionId}/replace`), {
      method: 'POST',
      headers: auth.headers,
    })
    if (!res.ok) {
      const text = await res.text()
      return new Response(text || 'Impossible de créer la variante', { status: res.status })
    }
    const body = (await res.json()) as { newSessionId: string }
    return Response.json(body)
  } catch (err) {
    console.error('[session replace]', err)
    return new Response('Impossible de créer la variante', { status: 500 })
  }
}
