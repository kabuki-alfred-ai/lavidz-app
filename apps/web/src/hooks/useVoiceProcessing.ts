import { useRef } from 'react'
import type { CompositionSegment } from '@/remotion/LavidzComposition'
import type { WordTimestamp } from '@/remotion/themeTypes'
import {
  getVideoDuration,
  getAudioDuration,
  generateTTS,
  type RawRecording,
  type CleanvoiceConfig,
  FPS,
} from '@/components/session/process-view-utils'

// Remap word timestamps after silence/filler cuts.
// keepIntervals: segments of the original video that were kept (in original time).
// Returns timestamps relative to the new cut video.
export function remapWordTimestamps(
  words: WordTimestamp[],
  keepIntervals: { start: number; end: number }[],
): WordTimestamp[] {
  const result: WordTimestamp[] = []
  let timeOffset = 0
  for (const seg of keepIntervals) {
    for (const w of words) {
      if (w.end <= seg.start || w.start >= seg.end) continue
      result.push({
        word: w.word,
        start: timeOffset + Math.max(0, w.start - seg.start),
        end: timeOffset + Math.min(seg.end - seg.start, w.end - seg.start),
      })
    }
    timeOffset += seg.end - seg.start
  }
  result.sort((a, b) => a.start - b.start)
  return result
}

interface VoiceProcessingParams {
  recordings: RawRecording[]
  sessionId: string
  silenceCutEnabled: boolean
  silenceThreshold: number
  fillerCutEnabled: boolean
  cleanvoiceEnabled: boolean
  cleanvoiceConfig: CleanvoiceConfig
  denoiseEnabled: boolean
  denoiseStrength: 'light' | 'moderate' | 'strong' | 'isolate'
  localTranscriptsRef: React.MutableRefObject<Record<string, string>>
  wordTimestampsRef: React.MutableRefObject<Record<string, WordTimestamp[]>>
  sourceWordTimestampsRef: React.MutableRefObject<Record<string, WordTimestamp[]>>
  ttsCache: Record<string, { voiceId: string; url: string }>
  processedCache: Record<string, { hash: string; url: string }>
  setLoadingStep: (s: string) => void
  setSilenceCutError: (s: string) => void
  setFillerCutError: (s: string) => void
  setCleanvoiceError: (s: string) => void
  setWordTimestampsMap: React.Dispatch<React.SetStateAction<Record<string, WordTimestamp[]>>>
  setTtsCache: React.Dispatch<React.SetStateAction<Record<string, { voiceId: string; url: string }>>>
  setProcessedCache: React.Dispatch<React.SetStateAction<Record<string, { hash: string; url: string }>>>
  setSegments: React.Dispatch<React.SetStateAction<CompositionSegment[] | null>>
  setReady: (v: boolean) => void
}

export function useVoiceProcessing(params: VoiceProcessingParams) {
  const {
    recordings, sessionId,
    silenceCutEnabled, silenceThreshold,
    fillerCutEnabled,
    cleanvoiceEnabled, cleanvoiceConfig,
    denoiseEnabled, denoiseStrength,
    localTranscriptsRef, wordTimestampsRef, sourceWordTimestampsRef,
    ttsCache, processedCache,
    setLoadingStep, setSilenceCutError, setFillerCutError, setCleanvoiceError,
    setWordTimestampsMap, setTtsCache, setProcessedCache,
    setSegments, setReady,
  } = params

  const prepareAbortRef = useRef<AbortController | null>(null)
  const blobUrlsRef = useRef<string[]>([])
  const durationsRef = useRef<number[]>([])
  const effectiveVideoUrlsRef = useRef<string[]>([])
  const lastProcessingHashRef = useRef<string | null>(null)

  const getCachedUrl = async (recordingId: string, type: 'tts' | 'processed'): Promise<string | null> => {
    try {
      const endpoint = type === 'tts' ? 'tts-url' : 'processed-url'
      const res = await fetch(`/api/admin/recordings/${recordingId}/${endpoint}?sessionId=${sessionId}`)
      if (!res.ok) return null
      const data = await res.json()
      return typeof data === 'string' ? data : null
    } catch { return null }
  }

  const uploadToCache = async (
    recordingId: string,
    sourceUrl: string,
    type: 'tts' | 'processed',
    extra: { voiceId?: string; processingHash?: string },
  ) => {
    try {
      const params = new URLSearchParams({ sessionId, type })
      if (extra.voiceId) params.set('voiceId', extra.voiceId)
      if (extra.processingHash) params.set('processingHash', extra.processingHash)
      const endpoint = `/api/admin/recordings/${recordingId}/cache?${params}`

      if (sourceUrl.startsWith('blob:')) {
        const blobRes = await fetch(sourceUrl)
        const blob = await blobRes.blob()
        const form = new FormData()
        form.append('file', blob, type === 'tts' ? 'audio.mp3' : 'video.mp4')
        form.append('type', type)
        if (extra.voiceId) form.append('voiceId', extra.voiceId)
        if (extra.processingHash) form.append('processingHash', extra.processingHash)
        await fetch(endpoint, { method: 'POST', body: form })
      } else {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceUrl, type, ...extra }),
        })
      }
    } catch (e) { console.warn('[cache] upload failed', e) }
  }

  const prepare = async (voiceId: string | null) => {
    prepareAbortRef.current?.abort()
    const abortCtrl = new AbortController()
    prepareAbortRef.current = abortCtrl

    setSilenceCutError('')
    setFillerCutError('')
    setCleanvoiceError('')

    const currentProcessingHash = cleanvoiceEnabled
      ? `cv-${JSON.stringify(cleanvoiceConfig)}`
      : `${silenceCutEnabled}-${silenceThreshold}-${fillerCutEnabled}-${denoiseEnabled}-${denoiseStrength}`

    const processingChanged = lastProcessingHashRef.current !== currentProcessingHash

    if (effectiveVideoUrlsRef.current.length === 0 || processingChanged) {
      effectiveVideoUrlsRef.current = []; durationsRef.current = []

      for (let i = 0; i < recordings.length; i++) {
        const rec = recordings[i]
        // Check processed video cache
        const cachedProcessed = processedCache[rec.id]
        if (cachedProcessed?.hash === currentProcessingHash && cachedProcessed.url) {
          console.log(`[cache] using cached processed video for recording ${rec.id}`)
          effectiveVideoUrlsRef.current.push(cachedProcessed.url)
          durationsRef.current.push(await getVideoDuration(cachedProcessed.url))
          continue
        }
        // If we have a cached entry with empty url, fetch the signed URL
        if (cachedProcessed?.hash === currentProcessingHash && !cachedProcessed.url) {
          const signedUrl = await getCachedUrl(rec.id, 'processed')
          if (signedUrl) {
            setProcessedCache(p => ({ ...p, [rec.id]: { hash: currentProcessingHash, url: signedUrl } }))
            console.log(`[cache] resolved processed URL for recording ${rec.id}`)
            effectiveVideoUrlsRef.current.push(signedUrl)
            durationsRef.current.push(await getVideoDuration(signedUrl))
            continue
          }
        }

        let realUrl = rec.videoUrl

        // Reset display timestamps to source
        const srcTs = sourceWordTimestampsRef.current[rec.id]
        if (srcTs?.length) wordTimestampsRef.current[rec.id] = srcTs

        if (cleanvoiceEnabled) {
          setLoadingStep(`Cleanvoice ${i+1}/${recordings.length}...`)
          try {
            const submitRes = await fetch('/api/cleanvoice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl: realUrl, config: cleanvoiceConfig }),
            })
            if (!submitRes.ok) {
              setCleanvoiceError(await submitRes.text())
            } else {
              const { cleanvoiceJobId, id } = await submitRes.json()
              let done = false
              for (let attempt = 0; attempt < 120 && !done && !abortCtrl.signal.aborted; attempt++) {
                await new Promise<void>((res) => {
                  const t = setTimeout(res, 5000)
                  abortCtrl.signal.addEventListener('abort', () => { clearTimeout(t); res() }, { once: true })
                })
                if (abortCtrl.signal.aborted) break
                setLoadingStep(`Cleanvoice ${i+1}/${recordings.length} (${Math.round((attempt+1)*5)}s)...`)
                const statusRes = await fetch(`/api/cleanvoice/status?jobId=${cleanvoiceJobId}&id=${id}`, { signal: abortCtrl.signal })
                if (!statusRes.ok) { setCleanvoiceError(await statusRes.text()); break }
                const data = await statusRes.json()
                if (data.done) {
                  done = true
                  if (data.error) {
                    setCleanvoiceError(data.error)
                  } else if (data.id) {
                    realUrl = `${window.location.origin}/api/cleanvoice/${data.id}`
                    if (data.wordTimestamps?.length) {
                      setWordTimestampsMap(prev => ({ ...prev, [rec.id]: data.wordTimestamps }))
                      wordTimestampsRef.current[rec.id] = data.wordTimestamps
                    }
                  }
                }
              }
              if (!done) setCleanvoiceError('Cleanvoice timeout — vidéo trop longue pour être traitée dans le délai imparti')
            }
          } catch { setCleanvoiceError('Cleanvoice échoué') }

          if (realUrl === rec.videoUrl) {
            try {
              const res = await fetch('/api/normalize-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl }) })
              if (res.ok) { const d = await res.json(); if (d.normalized && d.id) realUrl = `${window.location.origin}/api/normalize-video/${d.id}` }
            } catch {}
          }
        } else {
          if (silenceCutEnabled) {
            setLoadingStep(`Coupure silences ${i+1}/${recordings.length}...`)
            try {
              const res = await fetch('/api/silence-cut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl, threshold: silenceThreshold }) })
              if (res.ok) {
                const { id, keepIntervals } = await res.json()
                realUrl = `${window.location.origin}/api/silence-cut/${id}`
                if (keepIntervals?.length && wordTimestampsRef.current[rec.id]?.length) {
                  const remapped = remapWordTimestamps(wordTimestampsRef.current[rec.id], keepIntervals)
                  setWordTimestampsMap(prev => ({ ...prev, [rec.id]: remapped }))
                  wordTimestampsRef.current[rec.id] = remapped
                }
              } else setSilenceCutError(await res.text())
            } catch { setSilenceCutError('Coupure silences échouée') }
          } else {
            setLoadingStep(`Traitement vidéo ${i+1}/${recordings.length}...`)
            try {
              const res = await fetch('/api/normalize-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl }) })
              if (res.ok) { const d = await res.json(); if (d.normalized && d.id) realUrl = `${window.location.origin}/api/normalize-video/${d.id}` }
            } catch {}
          }

          if (fillerCutEnabled) {
            setLoadingStep(`Suppression tics de langage ${i+1}/${recordings.length}...`)
            try {
              const res = await fetch('/api/filler-cut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl }) })
              if (res.ok) {
                const { id, wordTimestamps } = await res.json()
                if (id) {
                  realUrl = `${window.location.origin}/api/filler-cut/${id}`
                  if (wordTimestamps?.length) {
                    setWordTimestampsMap(prev => ({ ...prev, [rec.id]: wordTimestamps }))
                    wordTimestampsRef.current[rec.id] = wordTimestamps
                  }
                }
              } else setFillerCutError(await res.text())
            } catch { setFillerCutError('Suppression tics échouée') }
          }

          if (denoiseEnabled) {
            setLoadingStep(`Réduction bruit ${i+1}/${recordings.length}...`)
            try {
              const res = await fetch('/api/denoise-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: realUrl, strength: denoiseStrength }) })
              if (res.ok) { const { id } = await res.json(); realUrl = `${window.location.origin}/api/denoise-video/${id}` }
            } catch {}
          }
        }

        let stableUrl = realUrl
        if (realUrl.includes('/api/normalize-video/') || realUrl.includes('/api/silence-cut/') || realUrl.includes('/api/denoise-video/') || realUrl.includes('/api/filler-cut/')) {
          try {
            await uploadToCache(rec.id, realUrl, 'processed', { processingHash: currentProcessingHash })
            const s3Url = await getCachedUrl(rec.id, 'processed')
            if (s3Url) {
              stableUrl = s3Url
              setProcessedCache(p => ({ ...p, [rec.id]: { hash: currentProcessingHash, url: s3Url } }))
            }
          } catch {}
        } else {
          setProcessedCache(p => ({ ...p, [rec.id]: { hash: currentProcessingHash, url: realUrl } }))
          uploadToCache(rec.id, realUrl, 'processed', { processingHash: currentProcessingHash })
        }

        effectiveVideoUrlsRef.current.push(stableUrl)
        const dur = await getVideoDuration(stableUrl)
        console.log(`[prepare] recording ${rec.id} duration=${dur}s url=${stableUrl}`)
        durationsRef.current.push(dur)
      }
      lastProcessingHashRef.current = currentProcessingHash
    }

    const ttsUrls: (string | null)[] = []
    if (voiceId) {
      for (let i = 0; i < recordings.length; i++) {
        const rec = recordings[i]
        const cachedTts = ttsCache[rec.id]
        if (cachedTts?.voiceId === voiceId && cachedTts.url) {
          console.log(`[cache] using cached TTS for recording ${rec.id}`)
          ttsUrls.push(cachedTts.url)
          continue
        }
        if (cachedTts?.voiceId === voiceId && !cachedTts.url) {
          const signedUrl = await getCachedUrl(rec.id, 'tts')
          if (signedUrl) {
            const proxyUrl = `/api/admin/recordings/${rec.id}/tts-audio?sessionId=${sessionId}`
            setTtsCache(p => ({ ...p, [rec.id]: { voiceId, url: proxyUrl } }))
            console.log(`[cache] resolved TTS URL for recording ${rec.id}`)
            ttsUrls.push(proxyUrl)
            continue
          }
        }

        setLoadingStep(`Voix IA ${i+1}/${recordings.length}...`)
        const ttsUrl = await generateTTS(rec.questionText, voiceId)
        ttsUrls.push(ttsUrl)

        if (ttsUrl) {
          setTtsCache(p => {
            const old = p[rec.id]
            if (old?.url?.startsWith('blob:')) URL.revokeObjectURL(old.url)
            return { ...p, [rec.id]: { voiceId, url: ttsUrl } }
          })
          uploadToCache(rec.id, ttsUrl, 'tts', { voiceId })
        }
      }
    } else {
      ttsUrls.push(...recordings.map(() => null))
    }

    const ttsDurations = await Promise.all(ttsUrls.map(u => u ? getAudioDuration(u) : Promise.resolve(4)))
    const built: CompositionSegment[] = recordings.map((rec, i) => {
      const ttsSecs = ttsDurations[i]
      return {
        id: rec.id, questionText: rec.questionText, videoUrl: effectiveVideoUrlsRef.current[i],
        transcript: localTranscriptsRef.current[rec.id] ?? rec.transcript,
        wordTimestamps: wordTimestampsRef.current[rec.id],
        videoDurationFrames: Math.max(Math.ceil((isFinite(durationsRef.current[i]) && durationsRef.current[i] > 0 && durationsRef.current[i] < 3600 ? durationsRef.current[i] : 120) * FPS), FPS),
        ttsUrl: ttsUrls[i],
        questionDurationFrames: Math.max(Math.ceil((ttsSecs + 0.5) * FPS), 3 * FPS),
      }
    })
    setSegments(built)
    setReady(true)
  }

  return {
    prepare,
    prepareAbortRef,
    blobUrlsRef,
    durationsRef,
    effectiveVideoUrlsRef,
    lastProcessingHashRef,
    getCachedUrl,
    uploadToCache,
  }
}
