export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized } from '@/lib/api-proxy'

/**
 * POST /api/sessions/:sessionId/hooks/chosen { chosen: 'native' | 'marketing' | null }
 * Mémorise le choix user pour la publication.
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
    if (body?.chosen !== null && body?.chosen !== 'native' && body?.chosen !== 'marketing') {
      return new Response("chosen doit être 'native', 'marketing' ou null", { status: 400 })
    }

    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const res = await fetch(apiUrl(`/ai/sessions/${sessionId}/hooks/chosen`), {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ chosen: body.chosen }),
    })
    if (!res.ok) {
      const text = await res.text()
      return new Response(text || 'Impossible de valider le choix', { status: res.status })
    }
    return Response.json(await res.json())
  } catch (err) {
    console.error('[session hooks chosen]', err)
    return new Response('Impossible de valider le choix', { status: 500 })
  }
}
