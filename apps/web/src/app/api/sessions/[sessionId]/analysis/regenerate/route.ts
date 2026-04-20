export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized } from '@/lib/api-proxy'

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

    const res = await fetch(apiUrl(`/sessions/${sessionId}/analysis/regenerate`), {
      method: 'POST',
      headers: auth.headers,
    })

    if (!res.ok) {
      return new Response('Impossible de relancer l\'analyse', { status: res.status })
    }
    return new Response(null, { status: 202 })
  } catch (err) {
    console.error('[analysis regenerate]', err)
    return new Response('Impossible de relancer l\'analyse', { status: 500 })
  }
}
