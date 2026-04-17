import { apiClient } from '@/lib/api'
import { RecordingSession } from '@/components/session/RecordingSession'
import type { ThemeDto } from '@lavidz/types'

interface Props {
  params: Promise<{ sessionId: string }>
}

interface SessionWithTheme {
  id: string
  status: string
  recipientName?: string
  theme: ThemeDto
  contentFormat?: string | null
  teleprompterScript?: string | null
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
        style={{ background: '#0a0a0a' }}
      >
        <p className="text-white/60 text-sm font-mono">Lien introuvable ou expiré.</p>
      </div>
    )
  }

  if (session.status === 'DONE' || session.status === 'FAILED') {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-8"
        style={{ background: '#0a0a0a' }}
      >
        <p className="text-white/60 text-sm font-mono">Ce lien n'est plus disponible.</p>
      </div>
    )
  }

  return (
    <RecordingSession
      theme={session.theme}
      initialSessionId={session.id}
      mode="shared"
      contentFormat={session.contentFormat as any}
      teleprompterScript={session.teleprompterScript}
    />
  )
}
