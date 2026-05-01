export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
      ? user.activeOrgId
      : user.organizationId
    if (!orgId) return new Response('No organization', { status: 400 })

    // Get recent threads grouped by threadId with last activity date
    const grouped = await prisma.chatMessage.groupBy({
      by: ['threadId'],
      where: { organizationId: orgId },
      _max: { createdAt: true },
      _count: { id: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: 30,
    })

    if (grouped.length === 0) {
      return Response.json({ threads: [] })
    }

    // For each thread, get the first user message as preview
    const threadIds = grouped.map((g) => g.threadId)
    const firstMessages = await prisma.chatMessage.findMany({
      where: { organizationId: orgId, threadId: { in: threadIds }, role: 'user' },
      orderBy: { createdAt: 'asc' },
      select: { threadId: true, content: true, createdAt: true },
      distinct: ['threadId'],
    })

    const firstByThread = new Map(firstMessages.map((m) => [m.threadId, m]))

    const threads = grouped.map((g) => {
      const first = firstByThread.get(g.threadId)
      return {
        threadId: g.threadId,
        preview: first?.content?.slice(0, 120) ?? '',
        lastAt: g._max.createdAt,
        messageCount: g._count.id,
      }
    })

    return Response.json({ threads })
  } catch (err: any) {
    console.error('[GET /api/chat/threads]', err)
    return new Response(err.message ?? 'Internal error', { status: 500 })
  }
}
