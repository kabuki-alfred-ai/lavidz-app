import { notFound, redirect } from 'next/navigation'
import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { deriveCreativeState } from '@/lib/creative-state'
import { SubjectWorkspace } from './SubjectWorkspace'

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
    include: {
      calendarEntries: {
        orderBy: { scheduledDate: 'asc' },
        select: {
          id: true,
          scheduledDate: true,
          format: true,
          status: true,
          aiSuggestions: true,
        },
      },
      sessions: {
        orderBy: { createdAt: 'desc' },
        include: {
          theme: { select: { name: true, questions: { where: { active: true }, orderBy: { order: 'asc' }, select: { id: true, text: true } } } },
        },
      },
    },
  })

  if (!topic) notFound()

  const creativeState = deriveCreativeState({
    topicStatus: topic.status,
    briefLength: topic.brief?.length ?? 0,
    calendarEntriesCount: topic.calendarEntries.length,
    sessions: topic.sessions.map((s) => ({ status: s.status })),
  })

  // Pull profile pillars for contextual dropdown
  const profile = await prisma.entrepreneurProfile.findUnique({
    where: { organizationId: orgId },
    select: { editorialPillars: true },
  })

  const nextScheduled = topic.calendarEntries[0] ?? null

  return (
    <SubjectWorkspace
      initial={{
        id: topic.id,
        name: topic.name,
        brief: topic.brief,
        pillar: topic.pillar,
        status: topic.status,
        threadId: topic.threadId,
        updatedAt: topic.updatedAt.toISOString(),
      }}
      creativeState={creativeState}
      availablePillars={profile?.editorialPillars ?? []}
      nextScheduled={
        nextScheduled
          ? {
              id: nextScheduled.id,
              scheduledDate: nextScheduled.scheduledDate.toISOString(),
              format: nextScheduled.format,
              aiSuggestions: (nextScheduled.aiSuggestions as Record<string, unknown> | null) ?? null,
            }
          : null
      }
      calendarCount={topic.calendarEntries.length}
      sessions={topic.sessions.map((s) => ({
        id: s.id,
        status: s.status,
        contentFormat: s.contentFormat,
        createdAt: s.createdAt.toISOString(),
        themeName: s.theme?.name ?? null,
        questionsCount: s.theme?.questions?.length ?? 0,
      }))}
    />
  )
}
