export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { TeamClient } from './TeamClient'
import { redirect } from 'next/navigation'

export default async function TeamPage() {
  const user = await getSessionUser()
  if (user?.role !== 'SUPERADMIN') redirect('/admin')

  const [admins, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'SUPERADMIN' },
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.adminInvitation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: { select: { email: true, firstName: true, lastName: true } },
      },
    }),
  ])

  // Serialize Dates to strings for client component
  const serialized = JSON.parse(JSON.stringify({ admins, invitations }))

  return <TeamClient admins={serialized.admins} invitations={serialized.invitations} currentUserId={user.userId} />
}
