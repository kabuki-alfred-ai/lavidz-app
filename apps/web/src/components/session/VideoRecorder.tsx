'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Download, Loader2, Video } from 'lucide-react'
import type { CompositionSegment } from '@/remotion/LavidzComposition'
import type { TransitionTheme, IntroSettings } from '@/remotion/themeTypes'
import type { SubtitleSettings } from '@/remotion/subtitleTypes'

const FPS = 30

interface Props {
  segments: CompositionSegment[]
  theme: TransitionTheme
  intro: IntroSettings
  subtitleSettings: SubtitleSettings
  questionCardSecs: number
  width: number
  height: number
  themeName: string
}

interface TimelineEntry {
  type: 'intro' | 'question' | 'clip'
  startTime: number
  duration: number
  index: number
}

// ─── Canvas drawing helpers ───────────────────────────────────────────────────

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

function drawSlide(
  ctx: CanvasRenderingContext2D,
  text: string,
  theme: TransitionTheme,
  w: number, h: number,
  logoImg: HTMLImageElement | null = null,
) {
  ctx.fillStyle = theme.backgroundColor
  ctx.fillRect(0, 0, w, h)

  const fontSize = Math.round(h * 0.085)
  ctx.font = `${theme.fontWeight} ${fontSize}px ${theme.fontFamily}`
  ctx.fillStyle = theme.textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  let textStartY = h / 2

  if (logoImg) {
    const lh = Math.round(h * 0.08)
    const lw = Math.round(logoImg.naturalWidth * (lh / logoImg.naturalHeight))
    const logoY = h * 0.32
    ctx.drawImage(logoImg, (w - lw) / 2, logoY, lw, lh)
    textStartY = h * 0.58
  }

  const lines = wrapLines(ctx, text, w * 0.84)
  const lineH = fontSize * 1.25
  const totalH = lines.length * lineH
  const startY = textStartY - totalH / 2
  lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lineH + lineH / 2))
}

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number, h: number,
) {
  const vw = video.videoWidth || w
  const vh = video.videoHeight || h
  const vRatio = vw / vh
  const cRatio = w / h

  let sx = 0, sy = 0, sw = vw, sh = vh
  if (vRatio > cRatio) { sw = vh * cRatio; sx = (vw - sw) / 2 }
  else { sh = vw / cRatio; sy = (vh - sh) / 2 }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h)
}

function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  transcript: string,
  localTime: number,
  totalDuration: number,
  settings: SubtitleSettings,
  w: number, h: number,
) {
  const words = transcript.split(/\s+/).filter(Boolean)
  if (!words.length) return

  const wpl = settings.wordsPerLine
  const timePerWord = totalDuration / words.length
  const wordIndex = Math.min(Math.floor(localTime / timePerWord), words.length - 1)
  const winStart = Math.floor(wordIndex / wpl) * wpl
  const winWords = words.slice(winStart, winStart + wpl)
  const active = wordIndex - winStart

  const py = h * (settings.position / 100)
  const fontSize = settings.size

  ctx.font = `900 ${fontSize}px Impact, "Arial Narrow", sans-serif`

  // Measure total width for centering
  const spaceW = ctx.measureText(' ').width
  const wordWidths = winWords.map((ww) => ctx.measureText(ww).width)
  const totalW = wordWidths.reduce((a, b) => a + b, 0) + spaceW * (winWords.length - 1)

  let x = w / 2 - totalW / 2
  winWords.forEach((word, i) => {
    ctx.fillStyle = i === active ? '#FFE600' : '#FFFFFF'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    // outline
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = fontSize * 0.1
    ctx.strokeText(word, x, py)
    ctx.fillText(word, x, py)
    x += wordWidths[i] + (i < winWords.length - 1 ? spaceW : 0)
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VideoRecorder({
  segments, theme, intro, subtitleSettings, questionCardSecs, width, height, themeName,
}: Props) {
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef(false)

  const startRecording = async () => {
    setRecording(true)
    setProgress(0)
    setOutputUrl(null)
    setError('')
    abortRef.current = false

    try {
      // Build timeline
      const timeline: TimelineEntry[] = []
      let t = 0

      if (intro.enabled && intro.hookText) {
        timeline.push({ type: 'intro', startTime: t, duration: intro.durationSeconds, index: -1 })
        t += intro.durationSeconds
      }
      for (let i = 0; i < segments.length; i++) {
        timeline.push({ type: 'question', startTime: t, duration: questionCardSecs, index: i })
        t += questionCardSecs
        const clipDur = segments[i].videoDurationFrames / FPS
        timeline.push({ type: 'clip', startTime: t, duration: clipDur, index: i })
        t += clipDur
      }
      const totalDuration = t

      // Pre-load logo
      let logoImg: HTMLImageElement | null = null
      if (intro.enabled && intro.logoUrl) {
        try {
          logoImg = await new Promise<HTMLImageElement>((res, rej) => {
            const img = new Image(); img.crossOrigin = 'anonymous'
            img.onload = () => res(img); img.onerror = rej; img.src = intro.logoUrl
          })
        } catch { logoImg = null }
      }

      // Pre-load video elements
      const videoEls = segments.map((seg) => {
        const v = document.createElement('video')
        v.src = seg.videoUrl
        v.preload = 'auto'
        v.muted = true // muted in DOM, audio goes through AudioContext
        v.load()
        return v
      })

      await Promise.all(videoEls.map((v) =>
        new Promise<void>((res) => {
          if (v.readyState >= 3) { res(); return }
          v.oncanplaythrough = () => res()
          setTimeout(res, 5000) // timeout fallback
        })
      ))

      // Setup AudioContext + canvas
      const audioCtx = new AudioContext()
      const dest = audioCtx.createMediaStreamDestination()

      // Connect each video element's audio to the mixer
      const videoSources = videoEls.map((v) => {
        const src = audioCtx.createMediaElementSource(v)
        src.connect(dest)
        return src
      })

      // TTS audio elements (one per segment)
      const ttsEls = segments.map((seg) => {
        const a = new Audio()
        a.src = seg.ttsUrl ?? ''
        return a
      })
      const ttsSources = ttsEls
        .filter((a) => a.src)
        .map((a) => {
          const src = audioCtx.createMediaElementSource(a)
          src.connect(dest)
          return src
        })

      // Canvas + MediaRecorder
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!

      const videoStream = canvas.captureStream(FPS)
      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ])

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus' : 'video/webm'
      const mediaRecorder = new MediaRecorder(combined, { mimeType })
      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      mediaRecorder.start(100)

      // Render loop
      const startTs = performance.now()
      let lastClipIndex = -1
      let lastQuestionIndex = -1

      await new Promise<void>((resolve) => {
        const tick = () => {
          if (abortRef.current) { resolve(); return }

          const elapsed = (performance.now() - startTs) / 1000
          if (elapsed >= totalDuration) { resolve(); return }

          setProgress(Math.round((elapsed / totalDuration) * 100))

          // Find active segment (last one whose startTime <= elapsed)
          let current: TimelineEntry | null = null
          for (const entry of timeline) {
            if (entry.startTime <= elapsed) current = entry
          }

          if (!current) { requestAnimationFrame(tick); return }

          const localTime = elapsed - current.startTime

          if (current.type === 'intro') {
            drawSlide(ctx, intro.hookText, theme, width, height, logoImg)

          } else if (current.type === 'question') {
            const i = current.index
            if (i !== lastQuestionIndex) {
              lastQuestionIndex = i
              videoEls.forEach((v) => v.pause())
              ttsEls.forEach((a, j) => { if (j !== i) a.pause() })
              if (ttsEls[i]?.src) {
                ttsEls[i].currentTime = 0
                ttsEls[i].play().catch(() => {})
              }
            }
            drawSlide(ctx, segments[i].questionText, theme, width, height)

          } else if (current.type === 'clip') {
            const i = current.index
            const video = videoEls[i]
            if (i !== lastClipIndex) {
              lastClipIndex = i
              videoEls.forEach((v, j) => { if (j !== i) v.pause() })
              ttsEls.forEach((a) => a.pause())
              video.currentTime = 0
              video.muted = false
              video.play().catch(() => {})
            }

            if (video.readyState >= 2) {
              drawVideoFrame(ctx, video, width, height)
            } else {
              ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height)
            }

            if (segments[i].transcript) {
              drawSubtitles(ctx, segments[i].transcript!, localTime,
                segments[i].videoDurationFrames / FPS, subtitleSettings, width, height)
            }
          }

          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })

      // Cleanup
      videoEls.forEach((v) => { v.pause(); v.src = '' })
      ttsEls.forEach((a) => { a.pause(); a.src = '' })
      videoSources.forEach((s) => s.disconnect())
      ttsSources.forEach((s) => s.disconnect())
      mediaRecorder.stop()
      await new Promise<void>((res) => { mediaRecorder.onstop = () => res() })
      await audioCtx.close()

      const blob = new Blob(chunks, { type: mimeType })
      setOutputUrl(URL.createObjectURL(blob))
      setProgress(100)
    } catch (err) {
      console.error('Recording error:', err)
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setRecording(false)
    }
  }

  const download = () => {
    if (!outputUrl) return
    const a = document.createElement('a')
    a.href = outputUrl
    a.download = `${themeName.toLowerCase().replace(/\s+/g, '-')}-montage.webm`
    a.click()
  }

  return (
    <div className="border border-border p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-sans font-bold text-sm">Exporter la vidéo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enregistrement canvas · Identique à la preview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {outputUrl && (
            <Button variant="outline" size="sm" onClick={download}>
              <Download size={12} />
              Télécharger
            </Button>
          )}
          {!recording && (
            <Button size="sm" onClick={startRecording}>
              <Video size={12} />
              {outputUrl ? 'Ré-enregistrer' : 'Exporter'}
            </Button>
          )}
          {recording && (
            <Button size="sm" variant="secondary" onClick={() => { abortRef.current = true }}>
              <Loader2 size={12} className="animate-spin" />
              Annuler
            </Button>
          )}
        </div>
      </div>

      {recording && (
        <div className="flex flex-col gap-2">
          <Progress value={progress} />
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Enregistrement en cours... {progress}%
          </p>
        </div>
      )}

      {error && <p className="text-xs text-destructive font-mono">{error}</p>}

      {!recording && !outputUrl && (
        <p className="text-[10px] text-muted-foreground/50 font-mono">
          Reproduit exactement la preview — 100% local, aucun envoi serveur.
        </p>
      )}
    </div>
  )
}
