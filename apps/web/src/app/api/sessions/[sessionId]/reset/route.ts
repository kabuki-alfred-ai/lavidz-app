export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized } from '@/lib/api-proxy'

/**
 * Task 5.2 — POST /api/sessions/:sessionId/reset : proxy vers NestJS pour
 * faire un soft-discard des recordings et ramener la session en PENDING.
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

    const res = await fetch(apiUrl(`/sessions/${sessionId}/reset`), {
      method: 'POST',
      headers: auth.headers,
    })
    if (!res.ok) {
      const text = await res.text()
      return new Response(text || 'Impossible de réinitialiser ce tournage', { status: res.status })
    }
    const body = await res.json()
    return Response.json(body)
  } catch (err) {
    console.error('[session reset]', err)
    return new Response('Impossible de réinitialiser ce tournage', { status: 500 })
  }
}
