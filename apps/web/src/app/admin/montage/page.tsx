import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { MontageClient } from './MontageClient'

export default async function MontagePage() {
  const user = await getSessionUser()
  const effectiveOrgId =
    user?.role === 'SUPERADMIN' && user?.activeOrgId
      ? user.activeOrgId
      : user?.organizationId ?? null

  const orgWhere = effectiveOrgId ? { organizationId: effectiveOrgId } : {}
  const sessionWhere = effectiveOrgId ? { theme: { organizationId: effectiveOrgId } } : {}

  const [rawThemes, rawSessions] = await Promise.all([
    prisma.theme.findMany({
      where: orgWhere,
      include: { questions: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    }),
    prisma.session.findMany({
      where: {
        ...sessionWhere,
        status: { in: ['SUBMITTED', 'PROCESSING', 'DONE'] },
      },
      include: {
        theme: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { submittedAt: 'desc' },
    }),
  ])

  const themes = rawThemes.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    questions: t.questions.map(q => ({
      ...q,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    })),
  }))

  const sessions = rawSessions.map(s => ({
    id: s.id,
    status: s.status,
    recipientEmail: s.recipientEmail ?? undefined,
    recipientName: s.recipientName ?? undefined,
    version: s.version,
    finalVideoKey: s.finalVideoKey ?? undefined,
    submittedAt: s.submittedAt?.toISOString(),
    deliveredAt: s.deliveredAt?.toISOString(),
    theme: s.theme,
  }))

  return <MontageClient themes={themes} initialSessions={sessions} />
}
