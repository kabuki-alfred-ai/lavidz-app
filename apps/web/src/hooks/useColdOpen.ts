import type { CompositionSegment } from '@/remotion/LavidzComposition'
import type { WordTimestamp } from '@/remotion/themeTypes'
import { FPS } from '@/components/session/process-view-utils'

export type ColdOpenCandidate = {
  hookPhrase: string
  startInSeconds: number
  endInSeconds: number
  segmentId: string
  angle?: string
  why?: string
}

interface ColdOpenParams {
  segments: CompositionSegment[] | null
  effectiveSegments: CompositionSegment[] | null | undefined
  ready: boolean
  wordTimestampsRef: React.MutableRefObject<Record<string, WordTimestamp[]>>
  setColdOpenEnabled: (v: boolean) => void
  setColdOpenData: React.Dispatch<React.SetStateAction<{ hookPhrase: string; startInSeconds: number; endInSeconds: number; segmentId: string } | null>>
  setColdOpenCandidates: React.Dispatch<React.SetStateAction<ColdOpenCandidate[]>>
  setColdOpenLoading: (v: boolean) => void
  setColdOpenError: (s: string) => void
  setInlaysEnabled: (v: boolean) => void
  setWordEmojisBySegmentId: React.Dispatch<React.SetStateAction<Record<string, { word: string; emoji: string }[]>>>
  setSubtitleSettings: React.Dispatch<React.SetStateAction<import('@/remotion/subtitleTypes').SubtitleSettings>>
}

export function useColdOpen(params: ColdOpenParams) {
  const {
    segments, effectiveSegments, ready,
    wordTimestampsRef,
    setColdOpenEnabled, setColdOpenData, setColdOpenCandidates,
    setColdOpenLoading, setColdOpenError,
    setInlaysEnabled, setWordEmojisBySegmentId, setSubtitleSettings,
  } = params

  const runColdOpenAnalysis = async () => {
    if (!segments?.length) {
      setColdOpenError('Aucun segment disponible.')
      return
    }
    setColdOpenLoading(true)
    setColdOpenError('')
    try {
      const segsWithTranscript = (effectiveSegments ?? segments ?? []).filter(s => s.transcript)
      if (!segsWithTranscript.length) {
        setColdOpenError('Aucune transcription trouvée.')
        return
      }

      // First segment → cold open + inlays (single hook for the whole video)
      const firstSeg = segsWithTranscript[0]
      const firstWts = firstSeg.wordTimestamps ?? wordTimestampsRef.current[firstSeg.id] ?? []
      const firstRes = await fetch('/api/cold-open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: firstSeg.transcript, wordTimestamps: firstWts, segmentId: firstSeg.id, videoDurationSeconds: firstSeg.videoDurationFrames / FPS }),
      })
      if (!firstRes.ok) { setColdOpenError(await firstRes.text()); return }
      const firstData = await firstRes.json()

      const candidates: ColdOpenCandidate[] = Array.isArray(firstData.coldOpenCandidates)
        ? firstData.coldOpenCandidates
        : firstData.coldOpen
          ? [firstData.coldOpen]
          : []

      setColdOpenCandidates(candidates)

      if (candidates.length) {
        // Auto-select the strongest candidate (first one)
        setColdOpenData(candidates[0])
        setColdOpenEnabled(true)
      } else if (firstData.coldOpen) {
        setColdOpenData(firstData.coldOpen)
        setColdOpenEnabled(true)
      }

      // All segments → context emojis (parallel, per-segment timestamps)
      const emojiResults = await Promise.all(
        segsWithTranscript.map(async seg => {
          const wts = seg.wordTimestamps ?? wordTimestampsRef.current[seg.id] ?? []
          try {
            const res = await fetch('/api/cold-open', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ transcript: seg.transcript, wordTimestamps: wts, segmentId: seg.id, videoDurationSeconds: seg.videoDurationFrames / FPS }),
            })
            if (!res.ok) return { segId: seg.id, emojis: [] }
            const data = await res.json()
            return { segId: seg.id, emojis: data.wordEmojis ?? [] }
          } catch { return { segId: seg.id, emojis: [] } }
        }),
      )

      const newMap: Record<string, { word: string; emoji: string }[]> = {}
      for (const { segId, emojis } of emojiResults) {
        if (emojis.length) newMap[segId] = emojis
      }
      if (Object.keys(newMap).length) {
        setWordEmojisBySegmentId(newMap)
        setSubtitleSettings(p => ({ ...p, animatedEmojis: true }))
      }
    } catch (e: any) {
      setColdOpenError(e?.message ?? 'Erreur analyse cold open')
    } finally {
      setColdOpenLoading(false)
    }
  }

  return { runColdOpenAnalysis }
}
