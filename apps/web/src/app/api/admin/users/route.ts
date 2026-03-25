import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getSessionUser()
  if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN')) {
    return new Response('Forbidden', { status: 403 })
  }

  const where = user.role === 'SUPERADMIN'
    ? {}
    : { organizationId: user.organizationId }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      organization: { select: { name: true, slug: true } },
      createdAt: true,
    },
  })

  return Response.json(users)
}
