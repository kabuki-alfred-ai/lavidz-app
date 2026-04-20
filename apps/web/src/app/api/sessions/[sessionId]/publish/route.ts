export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { unauthorized, noOrg } from '@/lib/api-proxy'

type RouteContext = { params: Promise<{ sessionId: string }> }

/**
 * Toggle the publication flag on a Session.
 * POST sets `publishedAt = now()`; DELETE clears it.
 * Both are used by the "C'est en ligne" button on the Publish view — the
 * entrepreneur self-reports, which is enough to make the narrative arc
 * accurate without LinkedIn OAuth.
 */
async function assertOwnership(sessionId: string, organizationId: string) {
  const session = await prisma.session.findFirst({
    where: { id: sessionId, theme: { organizationId } },
    select: { id: true },
  })
  return !!session
}

export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { sessionId } = await ctx.params
    const user = await getSessionUser()
    if (!user) return unauthorized()
    if (!user.organizationId) return noOrg()
    if (!(await assertOwnership(sessionId, user.organizationId))) {
      return new Response('Session introuvable', { status: 404 })
    }
    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: { publishedAt: new Date() },
      select: { publishedAt: true },
    })
    return Response.json({ publishedAt: updated.publishedAt })
  } catch (err) {
    console.error('[session/publish POST]', err)
    return new Response('Impossible de marquer publié', { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { sessionId } = await ctx.params
    const user = await getSessionUser()
    if (!user) return unauthorized()
    if (!user.organizationId) return noOrg()
    if (!(await assertOwnership(sessionId, user.organizationId))) {
      return new Response('Session introuvable', { status: 404 })
    }
    await prisma.session.update({
      where: { id: sessionId },
      data: { publishedAt: null },
    })
    return Response.json({ publishedAt: null })
  } catch (err) {
    console.error('[session/publish DELETE]', err)
    return new Response('Impossible', { status: 500 })
  }
}
