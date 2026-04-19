import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { SessionPrepare } from './SessionPrepare'

export default async function SessionPreparePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const user = await getSessionUser()
  if (!user?.organizationId) notFound()

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      theme: { organizationId: user.organizationId },
    },
    include: {
      theme: {
        include: {
          questions: { where: { active: true }, orderBy: { order: 'asc' } },
        },
      },
      topicEntity: { select: { id: true, name: true, brief: true, pillar: true, status: true } },
    },
  })

  if (!session) notFound()

  return <SessionPrepare session={JSON.parse(JSON.stringify(session))} />
}
