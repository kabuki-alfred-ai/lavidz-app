export const runtime = 'nodejs'

import { getFreshUser } from '@/lib/get-fresh-user'
import { prisma } from '@lavidz/database'

export async function GET() {
  try {
    const user = await getFreshUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    if (!user.organizationId) return new Response('Aucune organisation assignée.', { status: 400 })

    const members = await prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return Response.json(members)
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
