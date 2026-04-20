export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized } from '@/lib/api-proxy'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getSessionUser()
    if (!user?.organizationId) return unauthorized()
    const { sessionId } = await params
    const body = (await req.json().catch(() => null)) as
      | { type?: string; count?: number; note?: string }
      | null
    if (!body?.type) return new Response('type requis', { status: 400 })

    const session = await prisma.session.findFirst({
      where: { id: sessionId, theme: { organizationId: user.organizationId } },
      select: { id: true },
    })
    if (!session) return new Response('Tournage introuvable', { status: 404 })

    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const res = await fetch(apiUrl(`/sessions/${sessionId}/montage-hints`), {
      method: 'POST',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      return new Response(text || 'Impossible d\'enregistrer le hint', { status: res.status })
    }
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('[montage hint]', err)
    return new Response('Impossible d\'enregistrer le hint', { status: 500 })
  }
}
