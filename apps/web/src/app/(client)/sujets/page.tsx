import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { SujetsList } from './SujetsList'

export const dynamic = 'force-dynamic'

export default async function SujetsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
    ? user.activeOrgId
    : user.organizationId
  if (!orgId) redirect('/home')

  const topics = await prisma.topic.findMany({
    where: { organizationId: orgId, status: { not: 'DRAFT' } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      format: true,
      script: true,
      updatedAt: true,
      sessions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true },
      },
    },
  })

  return <SujetsList topics={topics.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    format: t.format,
    script: t.script as Record<string, unknown> | null,
    updatedAt: t.updatedAt.toISOString(),
    latestSession: t.sessions[0] ?? null,
  }))} />
}
