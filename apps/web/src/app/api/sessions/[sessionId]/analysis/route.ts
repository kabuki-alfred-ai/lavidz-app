export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getSessionUser()
    if (!user?.organizationId) return new Response('Unauthorized', { status: 401 })
    const { sessionId } = await params

    const session = await prisma.session.findFirst({
      where: { id: sessionId, theme: { organizationId: user.organizationId } },
      select: { id: true, theme: { select: { name: true } } },
    })
    if (!session) return new Response('Tournage introuvable', { status: 404 })

    const analysis = await prisma.recordingAnalysis.findUnique({ where: { sessionId } })

    return Response.json({
      sessionId,
      themeName: session.theme?.name ?? null,
      analysis,
    })
  } catch (err) {
    console.error('[analysis GET]', err)
    return new Response('Impossible de récupérer l\'analyse', { status: 500 })
  }
}
