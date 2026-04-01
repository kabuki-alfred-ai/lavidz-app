import { redirect } from 'next/navigation'
import { getFreshUser } from '@/lib/get-fresh-user'
import { prisma } from '@lavidz/database'
import { OrgTeamClient } from './OrgTeamClient'

export default async function OrgTeamPage() {
  const user = await getFreshUser()
  if (!user) redirect('/auth/login')
  if (!user.organizationId) redirect('/admin')

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

  const API = process.env.API_URL ?? 'http://localhost:3001'
  const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

  let invitations: unknown[] = []
  try {
    const res = await fetch(`${API}/api/users/org-invitations/by-org/${user.organizationId}`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })
    if (res.ok) invitations = await res.json()
  } catch {
    // Non-blocking
  }

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN'

  return (
    <OrgTeamClient
      members={members.map(m => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      invitations={invitations as any[]}
      currentUserId={user.userId}
      isAdmin={isAdmin}
    />
  )
}
