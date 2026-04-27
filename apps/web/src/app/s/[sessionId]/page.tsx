import { apiClient } from '@/lib/api'
import { RecordingSession } from '@/components/session/RecordingSession'
import { isRecordingGuide, type RecordingGuide } from '@/lib/recording-guide'
import { isNarrativeAnchor, type NarrativeAnchor } from '@/lib/narrative-anchor'
import { isRecordingScript, type RecordingScript } from '@/lib/recording-script'
import type { ThemeDto } from '@lavidz/types'

interface Props {
  params: Promise<{ sessionId: string }>
}

interface RecordingRef {
  id: string
  questionId: string
  supersededAt?: string | null
}

interface SessionWithTheme {
  id: string
  status: string
  recipientName?: string
  theme: ThemeDto
  contentFormat?: string | null
  teleprompterScript?: string | null
  topicId?: string | null
  recordingScript?: unknown
  lastActivityAt?: string | null
  recordings?: RecordingRef[]
  topicEntity?: {
    recordingGuide?: unknown
    narrativeAnchor?: unknown
  } | null
}

export default async function ShareableSessionPage({ params }: Props) {
  const { sessionId } = await params

  let session: SessionWithTheme | null = null
  try {
    session = await apiClient<SessionWithTheme>(`/sessions/${sessionId}`)
  } catch {
    // not found
  }

  if (!session) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-8"
        style={{ background: '#FAF8F5' }}
      >
        <p className="text-[rgba(26,23,20,0.55)] text-sm font-mono">Lien introuvable ou expiré.</p>
      </div>
    )
  }

  if (session.status === 'DONE' || session.status === 'FAILED') {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-8"
        style={{ background: '#FAF8F5' }}
      >
        <p className="text-[rgba(26,23,20,0.55)] text-sm font-mono">Ce lien n'est plus disponible.</p>
      </div>
    )
  }

  const rawGuide = session.topicEntity?.recordingGuide
  const recordingGuide: RecordingGuide | null = isRecordingGuide(rawGuide) ? rawGuide : null
  const rawAnchor = session.topicEntity?.narrativeAnchor
  const narrativeAnchor: NarrativeAnchor | null = isNarrativeAnchor(rawAnchor) ? rawAnchor : null
  const rawScript = session.recordingScript
  const recordingScript: RecordingScript | null = isRecordingScript(rawScript) ? rawScript : null

  // Task 7.4 — calcule les props pour ResumeBanner côté server : dernière
  // question répondue (canonical non-supersededAt), nombre de prises, date
  // de dernière activité.
  const canonicalRecordings = (session.recordings ?? []).filter((r) => !r.supersededAt)
  const answeredQuestionIds = new Set(canonicalRecordings.map((r) => r.questionId))
  const orderedQuestions = session.theme?.questions ?? []
  const nextQuestionIndex = orderedQuestions.findIndex((q) => !answeredQuestionIds.has(q.id))
  const resumeProps = {
    lastActivityAt: session.lastActivityAt ?? null,
    recordingsCount: canonicalRecordings.length,
    nextQuestionNumber: nextQuestionIndex >= 0 ? nextQuestionIndex + 1 : null,
    anchorUpdatedAt: narrativeAnchor?.updatedAt ?? null,
    scriptSyncedAt: recordingScript?.anchorSyncedAt ?? null,
  }

  return (
    <RecordingSession
      theme={session.theme}
      initialSessionId={session.id}
      mode="shared"
      contentFormat={session.contentFormat as any}
      teleprompterScript={session.teleprompterScript}
      topicId={session.topicId ?? undefined}
      narrativeAnchor={narrativeAnchor}
      recordingScript={recordingScript}
      recordingGuide={recordingGuide}
      resumeProps={resumeProps}
    />
  )
}
