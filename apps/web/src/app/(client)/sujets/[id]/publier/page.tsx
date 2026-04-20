import { notFound, redirect } from 'next/navigation'
import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { PublishView } from './PublishView'

export const dynamic = 'force-dynamic'

type PageProps = {
  // [id] dans l'URL = identifiant d'une Session (c'est la session qu'on publie)
  params: Promise<{ id: string }>
}

export default async function PublishPage({ params }: PageProps) {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  const { id: sessionId } = await params

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      theme: { organizationId: user.organizationId ?? undefined },
    },
    include: {
      theme: { select: { name: true, organizationId: true } },
      topicEntity: { select: { id: true, name: true, pillar: true } },
    },
  })
  if (!session) notFound()

  const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0]

  return (
    <PublishView
      sessionId={sessionId}
      themeName={session.theme?.name ?? null}
      topic={
        session.topicEntity
          ? {
              id: session.topicEntity.id,
              name: session.topicEntity.name,
              pillar: session.topicEntity.pillar,
            }
          : null
      }
      status={session.status}
      hasFinalVideo={!!session.finalVideoKey}
      authorName={authorName}
    />
  )
}
