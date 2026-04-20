export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized } from '@/lib/api-proxy'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string; questionId: string }> },
) {
  try {
    const user = await getSessionUser()
    if (!user?.organizationId) return unauthorized()
    const { sessionId, questionId } = await params

    const session = await prisma.session.findFirst({
      where: { id: sessionId, theme: { organizationId: user.organizationId } },
      select: { id: true },
    })
    if (!session) return new Response('Tournage introuvable', { status: 404 })

    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const res = await fetch(apiUrl(`/sessions/${sessionId}/recordings/${questionId}/redo`), {
      method: 'POST',
      headers: auth.headers,
    })

    if (!res.ok) {
      const text = await res.text()
      return new Response(text || 'Impossible d\'invalider cette prise', { status: res.status })
    }
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('[recording redo]', err)
    return new Response('Impossible d\'invalider cette prise', { status: 500 })
  }
}
