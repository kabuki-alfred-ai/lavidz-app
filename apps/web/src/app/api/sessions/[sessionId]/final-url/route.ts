export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()
    const { sessionId } = await params

    // Verify the session belongs to the current org before proxying.
    const session = await prisma.session.findFirst({
      where: { id: sessionId, theme: { organizationId: auth.orgId } },
      select: { id: true, finalVideoKey: true },
    })
    if (!session) return new Response('Tournage introuvable', { status: 404 })
    if (!session.finalVideoKey) return new Response('Pas de vidéo finale', { status: 404 })

    const res = await fetch(apiUrl(`/sessions/${sessionId}/final-url`), {
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })

    // Backend returns a plain string — normalise as JSON { url } to keep parsing simple.
    const raw = await res.text()
    const trimmed = raw.replace(/^"|"$/g, '')
    return Response.json({ url: trimmed })
  } catch (err) {
    console.error('[final-url]', err)
    return new Response('Impossible de récupérer la vidéo', { status: 500 })
  }
}
