import { apiClient } from '@/lib/api'
import { ProcessView } from '@/components/session/ProcessView'

interface Props {
  params: Promise<{ sessionId: string }>
}


export default async function ProcessPage({ params }: Props) {
  const { sessionId } = await params

  let session: any = null
  try {
    session = await apiClient(`/sessions/${sessionId}`)
  } catch {
    session = null
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-mono text-sm">Session introuvable.</p>
      </div>
    )
  }

  // Use the proxy route so the browser fetches videos over HTTPS (no mixed content)
  const videoUrls: Record<string, string> = {}
  for (const r of session.recordings.filter((r: any) => r.rawVideoKey)) {
    videoUrls[r.id] = `/api/video/${r.id}?sessionId=${sessionId}`
  }

  // Deduplicate: keep only the most recent recording per questionId
  // (user may have retaken a question → multiple recordings for same questionId)
  const latestByQuestion = new Map<string, any>()
  for (const r of session.recordings) {
    if (!r.rawVideoKey || !videoUrls[r.id]) continue
    const existing = latestByQuestion.get(r.questionId)
    if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
      latestByQuestion.set(r.questionId, r)
    }
  }

  // Sort by question order in the theme
  const questionOrder: Record<string, number> = {}
  session.theme.questions.forEach((q: any, i: number) => { questionOrder[q.id] = i })

  const recordings = Array.from(latestByQuestion.values())
    .sort((a, b) => (questionOrder[a.questionId] ?? 999) - (questionOrder[b.questionId] ?? 999))
    .map((r: any) => ({
      id: r.id,
      questionText:
        session.theme.questions.find((q: any) => q.id === r.questionId)?.text ?? '',
      videoUrl: videoUrls[r.id],
      transcript: r.transcript ?? null,
      wordTimestamps: Array.isArray(r.wordTimestamps) ? r.wordTimestamps : null,
      ttsAudioKey: r.ttsAudioKey ?? null,
      ttsVoiceId: r.ttsVoiceId ?? null,
      processedVideoKey: r.processedVideoKey ?? null,
      processingHash: r.processingHash ?? null,
    }))

  return (
    <ProcessView
      recordings={recordings}
      themeName={session.theme.name}
      sessionId={sessionId}
      themeSlug={session.theme.slug}
      montageSettings={session.montageSettings ?? null}
    />
  )
}
