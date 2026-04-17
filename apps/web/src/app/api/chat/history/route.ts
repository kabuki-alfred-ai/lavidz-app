export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'

// GET /api/chat/history — list threads or get messages for a thread
export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
      ? user.activeOrgId
      : user.organizationId
    if (!orgId) return new Response('No organization', { status: 400 })

    const { searchParams } = new URL(req.url)
    const threadId = searchParams.get('threadId')

    // If threadId provided, return messages for that thread
    if (threadId) {
      const messages = await prisma.chatMessage.findMany({
        where: { organizationId: orgId, threadId },
        orderBy: { createdAt: 'asc' },
        take: 200,
      })

      return Response.json(messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        toolInvocations: m.toolCalls ? JSON.parse(JSON.stringify(m.toolCalls)) : undefined,
      })))
    }

    // Otherwise, return list of threads (grouped by threadId)
    const threads = await prisma.$queryRaw<
      { threadId: string; firstMessage: string; messageCount: bigint; createdAt: Date; updatedAt: Date }[]
    >`
      SELECT
        "threadId",
        (SELECT content FROM "ChatMessage" c2 WHERE c2."threadId" = cm."threadId" AND c2.role = 'user' ORDER BY c2."createdAt" ASC LIMIT 1) as "firstMessage",
        COUNT(*) as "messageCount",
        MIN("createdAt") as "createdAt",
        MAX("createdAt") as "updatedAt"
      FROM "ChatMessage" cm
      WHERE "organizationId" = ${orgId}
      GROUP BY "threadId"
      ORDER BY MAX("createdAt") DESC
      LIMIT 50
    `

    return Response.json(threads.map((t) => ({
      threadId: t.threadId,
      preview: (t.firstMessage ?? 'Conversation').slice(0, 80),
      messageCount: Number(t.messageCount),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })))
  } catch (err: any) {
    return new Response(String(err), { status: 500 })
  }
}

// DELETE /api/chat/history — delete a thread or all
export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
      ? user.activeOrgId
      : user.organizationId
    if (!orgId) return new Response('No organization', { status: 400 })

    const { searchParams } = new URL(req.url)
    const threadId = searchParams.get('threadId')

    if (threadId) {
      await prisma.chatMessage.deleteMany({ where: { organizationId: orgId, threadId } })
    } else {
      await prisma.chatMessage.deleteMany({ where: { organizationId: orgId } })
    }

    return new Response(null, { status: 204 })
  } catch (err: any) {
    return new Response(String(err), { status: 500 })
  }
}
