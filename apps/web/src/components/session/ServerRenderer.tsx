'use client'

import { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react'
import type { CompositionSegment } from '@/remotion/LavidzComposition'
import type { TransitionTheme, IntroSettings, MotionSettings } from '@/remotion/themeTypes'
import type { SubtitleSettings } from '@/remotion/subtitleTypes'
import { Download, CheckCircle2 } from 'lucide-react'

interface Props {
  segments: CompositionSegment[]
  originalVideoUrls: string[]
  voiceId: string
  themeName: string
  theme: TransitionTheme
  intro: IntroSettings
  subtitleSettings: SubtitleSettings
  questionCardFrames: number
  fps: number
  width: number
  height: number
  sessionId?: string
  motionSettings?: MotionSettings
  onRenderComplete?: (outputUrl: string) => void
}

export interface ServerRendererHandle {
  render: () => void
  rendering: boolean
  outputUrl: string | null
}

export const ServerRenderer = forwardRef<ServerRendererHandle, Props>(function ServerRenderer(
  { segments, originalVideoUrls, voiceId, themeName, theme, intro, subtitleSettings, questionCardFrames, fps, width, height, sessionId, motionSettings, onRenderComplete },
  ref,
) {
  const [rendering, setRendering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  useEffect(() => () => stopPolling(), [])

  const render = async () => {
    setRendering(true)
    setProgress(0)
    setOutputUrl(null)
    setDone(false)
    setError('')

    try {
      const serverSegments = segments.map((seg, i) => ({
        ...seg,
        videoUrl: originalVideoUrls[i] ?? seg.videoUrl,
        ttsUrl: null,
      }))

      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: serverSegments, questionCardFrames, subtitleSettings, theme, intro, fps, width, height, voiceId, origin: window.location.origin, sessionId, motionSettings }),
      })
      if (!res.ok) throw new Error(await res.text())

      const { jobId } = await res.json()

      // Poll for progress
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/render/${jobId}/status`)
          if (!statusRes.ok) return
          const status = await statusRes.json()

          setProgress(status.progress ?? 0)

          if (status.done) {
            stopPolling()
            if (status.error) {
              setError(status.error)
              setRendering(false)
              return
            }
            // Download the result
            const dlRes = await fetch(`/api/render/${jobId}/download`)
            if (!dlRes.ok) throw new Error('Download failed')
            const blob = await dlRes.blob()
            const url = URL.createObjectURL(blob)
            setOutputUrl(url)
            setProgress(100)
            setDone(true)
            setRendering(false)
            onRenderComplete?.(url)
          }
        } catch (e) {
          stopPolling()
          setError(String(e))
          setRendering(false)
        }
      }, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setRendering(false)
    }
  }

  const download = () => {
    if (!outputUrl) return
    const a = document.createElement('a')
    a.href = outputUrl
    a.download = `${themeName.toLowerCase().replace(/\s+/g, '-')}-montage.mp4`
    a.click()
  }

  useImperativeHandle(ref, () => ({ render, rendering, outputUrl }), [render, rendering, outputUrl])

  return (
    <>
      {/* Status shown in page (after export) */}
      {!rendering && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && <p style={{ fontSize: 11, color: '#f87171', fontFamily: 'monospace' }}>{error}</p>}
          {outputUrl && done && (
            <button onClick={download}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px', borderRadius: 14, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: 'rgb(52,211,153)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <Download size={16} />
              Télécharger le MP4
            </button>
          )}
        </div>
      )}

      {/* Full-screen export overlay */}
      {rendering && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '40px 32px', maxWidth: 320, width: '100%' }}>

            {/* Animated ring */}
            <div style={{ position: 'relative', width: 120, height: 120 }}>
              <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="#fff" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{progress}<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.6 }}>%</span></span>
              </div>
            </div>

            {/* Status text */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>
                {progress < 10 ? 'Préparation...' : progress < 15 ? 'Bundling...' : progress < 98 ? 'Rendu en cours' : 'Finalisation...'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'monospace' }}>
                {progress < 15 ? 'Initialisation Remotion' : `Composition · H264 · ${width}×${height}`}
              </p>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#fff', borderRadius: 2, width: `${progress}%`, transition: 'width 0.6s ease' }} />
            </div>

            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>
              Ne fermez pas cette page
            </p>
          </div>
        </div>
      )}

      {/* Done overlay (brief) */}
      {done && !rendering && outputUrl && (
        <></>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
})
