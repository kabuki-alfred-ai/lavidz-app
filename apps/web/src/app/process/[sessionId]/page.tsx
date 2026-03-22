import { apiClient } from '@/lib/api'
import { ProcessView } from '@/components/session/ProcessView'

interface Props {
  params: Promise<{ sessionId: string }>
}

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ''

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

  // Pre-fetch all signed video URLs server-side (no COEP conflict here)
  const videoUrls: Record<string, string> = {}
  await Promise.all(
    session.recordings
      .filter((r: any) => r.rawVideoKey)
      .map(async (r: any) => {
        try {
          const res = await fetch(
            `${API}/api/sessions/${sessionId}/recordings/${r.id}/url`,
            {
              headers: { 'x-admin-secret': ADMIN_SECRET },
              cache: 'no-store',
            },
          )
          if (res.ok) {
            videoUrls[r.id] = await res.text()
          }
        } catch {
          // skip
        }
      }),
  )

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
    }))

  return (
    <ProcessView
      recordings={recordings}
      themeName={session.theme.name}
      sessionId={sessionId}
      themeSlug={session.theme.slug}
    />
  )
}
