import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { FeedbacksClient } from './FeedbacksClient'

export default async function FeedbacksPage() {
  const user = await getSessionUser()
  const effectiveOrgId =
    user?.role === 'SUPERADMIN' && user?.activeOrgId
      ? user.activeOrgId
      : user?.organizationId ?? null

  const where = effectiveOrgId
    ? { session: { theme: { organizationId: effectiveOrgId } } }
    : {}

  const [rawFeedbacks, agg] = await Promise.all([
    prisma.feedback.findMany({
      where,
      include: {
        session: {
          select: {
            recipientName: true,
            recipientEmail: true,
            theme: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.feedback.aggregate({
      where,
      _count: { id: true },
      _avg: { overallRating: true, questionRating: true },
    }),
  ])

  const feedbacks = rawFeedbacks.map(f => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
  }))

  const stats = {
    count: agg._count.id,
    avgOverall: Math.round((agg._avg.overallRating ?? 0) * 10) / 10,
    avgQuestion: Math.round((agg._avg.questionRating ?? 0) * 10) / 10,
  }

  return <FeedbacksClient feedbacks={feedbacks} stats={stats} />
}
