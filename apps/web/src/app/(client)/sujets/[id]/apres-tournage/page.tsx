import { notFound, redirect } from 'next/navigation'
import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { PostRecordingView } from '@/components/session/PostRecordingView'

export const dynamic = 'force-dynamic'

type PageProps = {
  // [id] dans l'URL = identifiant d'une Session (le post-tournage appartient à une session)
  params: Promise<{ id: string }>
}

function estimateDurationFromWords(wordTimestamps: unknown): number {
  if (!Array.isArray(wordTimestamps) || wordTimestamps.length === 0) return 0
  const last = wordTimestamps[wordTimestamps.length - 1] as Record<string, unknown> | undefined
  if (!last) return 0
  const end =
    typeof last.end === 'number'
      ? last.end
      : typeof last.endTime === 'number'
        ? last.endTime
        : null
  return end !== null ? Math.round(end * 1000) : 0
}

export default async function PostRecordingPage({ params }: PageProps) {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')
  const { id: sessionId } = await params

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      theme: { organizationId: user.organizationId ?? undefined },
    },
    include: {
      theme: {
        include: {
          questions: { where: { active: true }, orderBy: { order: 'asc' } },
        },
      },
      recordings: {
        orderBy: { createdAt: 'asc' },
        select: { wordTimestamps: true, status: true },
      },
    },
  })

  if (!session) notFound()

  const totalDurationMs = session.recordings.reduce(
    (sum, r) => sum + estimateDurationFromWords(r.wordTimestamps),
    0,
  )

  const activeRecordings = session.recordings.filter((r) => r.status !== 'FAILED').length

  const questions = session.theme.questions.map((q, index) => ({
    id: q.id,
    order: index,
    text: q.text,
  }))

  return (
    <PostRecordingView
      sessionId={sessionId}
      themeName={session.theme?.name ?? null}
      questions={questions}
      recordingsCount={activeRecordings}
      totalDurationMs={totalDurationMs}
      montageHref={`/process/${sessionId}`}
    />
  )
}
