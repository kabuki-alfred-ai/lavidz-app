import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || (user.role !== 'SUPERADMIN' && user.role !== 'ADMIN')) {
    return new Response('Forbidden', { status: 403 })
  }

  const withoutOrg = req.nextUrl.searchParams.get('withoutOrg') === 'true'

  let where: Record<string, unknown>

  if (user.role === 'SUPERADMIN') {
    where = withoutOrg ? { organizationId: null } : {}
  } else {
    where = { organizationId: user.organizationId }
  }

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
