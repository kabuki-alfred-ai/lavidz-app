import { apiClient } from '@/lib/api'
import type { ThemeDto } from '@lavidz/types'

interface Props {
  params: Promise<{ sessionId: string }>
}

interface SessionData {
  id: string
  status: string
  finalVideoKey?: string
  recipientName?: string
  theme: ThemeDto
}

export default async function VideoPage({ params }: Props) {
  const { sessionId } = await params

  let session: SessionData | null = null
  let videoUrl: string | null = null

  try {
    session = await apiClient<SessionData>(`/sessions/${sessionId}`)
  } catch {
    // not found
  }

  if (!session || !session.finalVideoKey || session.status !== 'DONE') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          gap: 16,
        }}
      >
        <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 13 }}>
          Vidéo non disponible.
        </p>
      </div>
    )
  }

  try {
    const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const ADMIN_SECRET = process.env.ADMIN_SECRET ?? process.env.NEXT_PUBLIC_ADMIN_SECRET ?? ''
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}/final-url`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
      next: { revalidate: 0 },
    })
    if (res.ok) videoUrl = await res.text()
  } catch {
    // unable to get url
  }

  const accent = session.theme?.brandColor ?? '#FF4D1C'
  const name = session.recipientName

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 24px 60px',
        gap: 32,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          {session.theme?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.theme.logoUrl} alt={session.theme.brandName ?? ''} style={{ height: 24, objectFit: 'contain' }} />
          ) : (
            <>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {session.theme?.brandName ?? 'Lavidz'}
              </span>
            </>
          )}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
          {name ? `Bonjour ${name} 👋` : 'Votre montage est prêt'}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          {session.theme?.name}
        </p>
      </div>

      {/* Video player */}
      {videoUrl && (
        <div style={{ width: '100%', maxWidth: 480, borderRadius: 16, overflow: 'hidden', background: '#111', border: '1px solid rgba(255,255,255,0.08)' }}>
          <video
            src={videoUrl}
            controls
            playsInline
            style={{ width: '100%', display: 'block', aspectRatio: '9/16', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Download button */}
      {videoUrl && (
        <a
          href={videoUrl}
          download="montage.mp4"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 28px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.8)',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ↓ Télécharger le MP4
        </a>
      )}
    </div>
  )
}
