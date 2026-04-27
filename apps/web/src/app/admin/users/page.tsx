export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { redirect } from 'next/navigation'
import { UsersClient } from './UsersClient'

export default async function UsersPage() {
  const user = await getSessionUser()
  if (user?.role !== 'SUPERADMIN') redirect('/admin')

  const users = await prisma.user.findMany({
    where: { role: { not: 'SUPERADMIN' } },
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

  const serialized = users.map(u => ({ ...u, role: u.role as 'ADMIN' | 'USER', createdAt: u.createdAt.toISOString() }))

  return <UsersClient users={serialized} currentUserId={user.userId} />
}
