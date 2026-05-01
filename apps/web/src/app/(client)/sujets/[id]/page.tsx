import { notFound, redirect } from 'next/navigation'
import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { SubjectDetail } from './SubjectDetail'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function SubjectPage({ params }: PageProps) {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  const orgId = (user.role === 'SUPERADMIN' && user.activeOrgId)
    ? user.activeOrgId
    : user.organizationId
  if (!orgId) redirect('/home')

  const { id } = await params

  const topic = await prisma.topic.findFirst({
    where: { id, organizationId: orgId },
    select: {
      id: true,
      name: true,
      status: true,
      format: true,
      script: true,
      threadId: true,
      brief: true,
      sessions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true },
      },
    },
  })

  if (!topic) notFound()

  const latestSession = topic.sessions[0] ?? null

  return (
    <SubjectDetail
      id={topic.id}
      name={topic.name}
      status={topic.status as any}
      format={topic.format as any}
      script={topic.script as any}
      threadId={topic.threadId}
      brief={topic.brief ?? null}
      latestSessionId={latestSession?.id ?? null}
    />
  )
}
