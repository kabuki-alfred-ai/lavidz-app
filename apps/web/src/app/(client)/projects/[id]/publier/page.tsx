import { notFound, redirect } from 'next/navigation'
import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { PublishView } from './PublishView'

export const dynamic = 'force-dynamic'

type PageProps = {
  // [id] dans l'URL = identifiant d'un Project (la nouvelle archi pivote la
  // publication sur Project, cf. Story 11). La Session reste visible via
  // Project.sessionId pour nourrir la vue.
  params: Promise<{ id: string }>
}

export default async function ProjectPublishPage({ params }: PageProps) {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  const { id: projectId } = await params

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId ?? undefined },
    select: { id: true, title: true, sessionId: true },
  })
  if (!project) notFound()

  // Project sans session source : on ne peut pas rendre la PublishView telle
  // quelle (elle dépend du statut session / finalVideoKey / LinkedIn sur une
  // session précise). On 404 gentiment — le cas est rare (un Project créé à la
  // main sans session source, V1.5+).
  if (!project.sessionId) notFound()

  const session = await prisma.session.findFirst({
    where: {
      id: project.sessionId,
      theme: { organizationId: user.organizationId ?? undefined },
    },
    include: {
      theme: { select: { name: true } },
      topicEntity: { select: { id: true, name: true, pillar: true } },
    },
  })
  if (!session) notFound()
  const publishedAt = session.publishedAt ? session.publishedAt.toISOString() : null

  const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0]

  return (
    <PublishView
      projectId={project.id}
      sessionId={session.id}
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
      publishedAt={publishedAt}
    />
  )
}
