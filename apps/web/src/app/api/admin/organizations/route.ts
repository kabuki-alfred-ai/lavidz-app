import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== 'SUPERADMIN') return new Response('Forbidden', { status: 403 })

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, themes: true } },
    },
  })

  return Response.json(orgs)
}
