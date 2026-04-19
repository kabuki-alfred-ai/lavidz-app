import { apiClient } from '@/lib/api'
import { ProcessView } from '@/components/session/ProcessView'
import { MONTAGE_PROFILES } from '@/lib/montage-profiles'
import type { ContentFormat } from '@lavidz/types'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function ProjectProcessPage({ params }: Props) {
  const { projectId } = await params

  let project: any = null
  try {
    project = await apiClient(`/projects/${projectId}`)
  } catch {
    project = null
  }

  if (!project || !project.clips?.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-mono text-sm">
          {!project ? 'Projet introuvable.' : 'Ce projet n\'a pas encore de rushes.'}
        </p>
      </div>
    )
  }

  const clips = (project.clips as any[]).sort((a: any, b: any) => a.order - b.order)

  // Determine content format: uniform (all same) or mixed
  const formats = [...new Set(
    clips
      .map((c: any) => c.recording?.session?.contentFormat)
      .filter(Boolean),
  )] as ContentFormat[]
  const contentFormat = formats.length === 1 ? formats[0] : 'MIXED'

  // Use the first clip's session as the "primary" sessionId for voice processing cache
  const primarySessionId = clips[0]?.recording?.session?.id ?? ''

  // Build recordings array for ProcessView
  const recordings = clips.map((clip: any) => {
    const rec = clip.recording
    const sessionId = rec.session?.id ?? primarySessionId
    const clipFormat = rec.session?.contentFormat as ContentFormat | null
    const profile = clipFormat ? MONTAGE_PROFILES[clipFormat] : null

    // Per-segment question card: 0 frames if the clip's format doesn't use question cards
    const questionDurationFrames = profile?.showQuestionCards === false ? 0 : undefined

    return {
      id: rec.id,
      questionText: rec.question?.text ?? '',
      videoUrl: `/api/video/${rec.id}?sessionId=${sessionId}`,
      transcript: rec.transcript ?? null,
      wordTimestamps: Array.isArray(rec.wordTimestamps) ? rec.wordTimestamps : null,
      ttsAudioKey: rec.ttsAudioKey ?? null,
      ttsVoiceId: rec.ttsVoiceId ?? null,
      processedVideoKey: rec.processedVideoKey ?? null,
      processingHash: rec.processingHash ?? null,
      // Extra field for per-segment question card control (used by initSegments)
      _questionDurationFrames: questionDurationFrames,
    }
  })

  return (
    <ProcessView
      recordings={recordings}
      themeName={project.title}
      sessionId={primarySessionId}
      themeSlug={projectId}
      montageSettings={project.montageSettings ?? null}
      contentFormat={contentFormat}
      projectId={projectId}
    />
  )
}
