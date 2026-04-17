import { apiClient } from '@/lib/api'
import type { ThemeDto } from '@lavidz/types'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ session?: string }>
}

export default async function SessionResultPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { session: sessionId } = await searchParams

  let theme: ThemeDto | null = null
  try {
    const themes = await apiClient<ThemeDto[]>('/themes')
    theme = themes.find(t => t.slug === slug) ?? null
  } catch {
    // ignore — degrade gracefully
  }

  const accent = theme?.brandColor ?? '#FF4D1C'
  const brandName = theme?.brandName ?? theme?.name ?? 'Lavidz'

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-6 px-8 text-center"
      style={{ background: '#0a0a0a' }}
    >
      {/* Checkmark */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
        style={{ background: `${accent}20`, border: `2px solid ${accent}60` }}
      >
        ✓
      </div>

      {/* Headline */}
      <div className="flex flex-col gap-2 max-w-xs">
        <p className="text-white font-bold text-xl">
          Merci pour vos réponses&nbsp;!
        </p>
        <p className="text-white/50 text-sm leading-relaxed">
          Vos enregistrements ont bien été envoyés à <span style={{ color: accent }}>{brandName}</span>.
          {' '}Vous recevrez bientôt votre vidéo.
        </p>
      </div>

      {/* Session ID for support */}
      {sessionId && (
        <p className="text-white/20 text-xs mt-4">
          Ref : {sessionId}
        </p>
      )}
    </div>
  )
}
