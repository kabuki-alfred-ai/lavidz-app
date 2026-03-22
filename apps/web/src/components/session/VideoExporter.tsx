'use client'

import { useState, useRef } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Download, Loader2, Scissors } from 'lucide-react'
import type { TransitionTheme, IntroSettings } from '@/remotion/themeTypes'
import type { SubtitleSettings } from '@/remotion/subtitleTypes'

interface Recording {
  id: string
  questionText: string
  videoUrl: string
  transcript: string | null
}

interface Props {
  recordings: Recording[]
  themeName: string
  theme: TransitionTheme
  intro: IntroSettings
  subtitleSettings: SubtitleSettings
  width: number
  height: number
}

type Step = 'idle' | 'loading-ffmpeg' | 'slides' | 'videos' | 'concat' | 'done' | 'error'

const STEP_LABELS: Record<Step, string> = {
  idle: '',
  'loading-ffmpeg': 'Chargement du moteur vidéo...',
  slides: 'Génération des transitions...',
  videos: 'Traitement des clips...',
  concat: 'Assemblage final...',
  done: 'Export prêt',
  error: 'Erreur',
}

const STEP_PROGRESS: Record<Step, number> = {
  idle: 0, 'loading-ffmpeg': 10, slides: 30, videos: 65, concat: 85, done: 100, error: 0,
}

const FPS = 30
const TRANSITION_SECS = 4

// ─── Canvas slide generator ───────────────────────────────────────────────────

async function renderSlideToFile(
  ffmpeg: FFmpeg,
  text: string,
  theme: TransitionTheme,
  name: string,
  w: number,
  h: number,
  durationSecs: number,
  logoUrl?: string,
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  // background
  ctx.fillStyle = theme.backgroundColor
  ctx.fillRect(0, 0, w, h)

  // logo
  if (logoUrl) {
    try {
      const img = await loadImage(logoUrl)
      const lh = Math.round(h * 0.08)
      const lw = Math.round(img.naturalWidth * (lh / img.naturalHeight))
      ctx.drawImage(img, (w - lw) / 2, h * 0.3, lw, lh)
    } catch { /* skip */ }
  }

  // text
  const fontSize = Math.round(h * 0.085)
  ctx.font = `${theme.fontWeight} ${fontSize}px ${theme.fontFamily}`
  ctx.fillStyle = theme.textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const lines = wrapText(ctx, text, w * 0.84)
  const lineH = fontSize * 1.25
  const totalH = lines.length * lineH
  const startY = logoUrl ? h * 0.55 : (h - totalH) / 2
  lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lineH + lineH / 2))

  // write frame as PNG
  const png = await canvasToUint8Array(canvas)
  await ffmpeg.writeFile(`${name}.png`, png)

  // static image + silent audio → video (audio required for concat compatibility)
  const mp4 = `${name}.mp4`
  await ffmpeg.exec([
    '-loop', '1', '-i', `${name}.png`,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-t', String(durationSecs),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    '-y', mp4,
  ])
  return mp4
}

// ─── Subtitle filter builder ──────────────────────────────────────────────────

function buildSubtitleFilter(
  transcript: string,
  durationSecs: number,
  settings: SubtitleSettings,
): string {
  const words = transcript.split(/\s+/).filter(Boolean)
  if (!words.length) return ''

  const chunks: string[] = []
  for (let i = 0; i < words.length; i += settings.wordsPerLine) {
    chunks.push(words.slice(i, i + settings.wordsPerLine).join(' '))
  }

  const chunkDur = durationSecs / chunks.length
  const py = `h*${(settings.position / 100).toFixed(3)}-text_h/2`

  return chunks
    .map((chunk, i) => {
      const t0 = (i * chunkDur).toFixed(3)
      const t1 = ((i + 1) * chunkDur).toFixed(3)
      const safe = chunk
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\u2019")
        .replace(/:/g, '\\:')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
      return (
        `drawtext=text='${safe}':` +
        `enable='between(t,${t0},${t1})':` +
        `fontsize=${settings.size}:fontcolor=white:` +
        `x=(w-text_w)/2:y=${py}:` +
        `box=1:boxcolor=black@0.7:boxborderw=10`
      )
    })
    .join(',')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const dur = video.duration
      if (!isFinite(dur)) {
        video.currentTime = 1e101
        video.ontimeupdate = () => {
          video.ontimeupdate = null
          resolve(isFinite(video.duration) ? video.duration : 30)
          video.src = ''
        }
      } else {
        resolve(dur)
      }
    }
    video.onerror = () => resolve(30)
    video.src = url
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
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

function canvasToUint8Array(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      blob!.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)))
    }, 'image/png')
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VideoExporter({ recordings, themeName, theme, intro, subtitleSettings, width, height }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [progress, setProgress] = useState(0)
  const [detail, setDetail] = useState('')
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const ffmpegRef = useRef<FFmpeg | null>(null)

  const run = async () => {
    setError('')
    setOutputUrl(null)
    setProgress(0)

    try {
      // 1. Load FFmpeg
      setStep('loading-ffmpeg')
      const ffmpeg = new FFmpeg()
      ffmpegRef.current = ffmpeg
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      // 2. Compute video durations (needed for subtitle timing)
      setStep('slides')
      setDetail('Analyse des durées...')
      const durations = await Promise.all(
        recordings.map((r) => getVideoDuration(r.videoUrl))
      )

      const allSegments: string[] = []

      // 3. Intro slide
      if (intro.enabled && intro.hookText) {
        setDetail('Intro...')
        const f = await renderSlideToFile(
          ffmpeg, intro.hookText, theme, 'intro', width, height,
          intro.durationSeconds, intro.logoUrl || undefined,
        )
        allSegments.push(f)
      }

      // 4. For each recording: slide + clip
      for (let i = 0; i < recordings.length; i++) {
        // Transition slide
        setStep('slides')
        setDetail(`Transition ${i + 1}/${recordings.length}...`)
        const slideFile = await renderSlideToFile(
          ffmpeg, recordings[i].questionText, theme,
          `slide_${i}`, width, height, TRANSITION_SECS,
        )
        allSegments.push(slideFile)

        // Video clip
        setStep('videos')
        setDetail(`Clip ${i + 1}/${recordings.length}...`)
        const rawData = await fetchFile(recordings[i].videoUrl)
        await ffmpeg.writeFile(`raw_${i}.webm`, rawData)

        // Step 1: transcode + scale (always works)
        const exitScale = await ffmpeg.exec([
          '-fflags', '+genpts',
          '-i', `raw_${i}.webm`,
          '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
          '-r', String(FPS),
          '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
          '-movflags', '+faststart',
          '-y', `clip_scaled_${i}.mp4`,
        ])
        if (exitScale !== 0) throw new Error(`Échec transcription clip ${i + 1}`)

        // Step 2: apply subtitles (optional, fallback to scaled clip if fails)
        let clipFile = `clip_scaled_${i}.mp4`
        if (recordings[i].transcript && durations[i] > 0) {
          const subFilter = buildSubtitleFilter(
            recordings[i].transcript!, durations[i], subtitleSettings,
          )
          if (subFilter) {
            const exitSub = await ffmpeg.exec([
              '-i', `clip_scaled_${i}.mp4`,
              '-vf', subFilter,
              '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
              '-c:a', 'copy',
              '-y', `clip_sub_${i}.mp4`,
            ])
            if (exitSub === 0) clipFile = `clip_sub_${i}.mp4`
          }
        }

        allSegments.push(clipFile)
        setProgress(Math.round(30 + (i + 1) / recordings.length * 50))
      }

      // 5. Concatenate
      setStep('concat')
      setDetail(`Assemblage de ${allSegments.length} segments...`)
      const concatList = allSegments.map((f) => `file '${f}'`).join('\n')
      await ffmpeg.writeFile('concat.txt', concatList)
      const exitConcat = await ffmpeg.exec([
        '-f', 'concat', '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        '-y', 'output.mp4',
      ])
      if (exitConcat !== 0) throw new Error('Échec de l\'assemblage final')

      const data = await ffmpeg.readFile('output.mp4')
      const blob = new Blob([data as BlobPart], { type: 'video/mp4' })
      setOutputUrl(URL.createObjectURL(blob))
      setStep('done')
      setProgress(100)
    } catch (err) {
      console.error('Export error:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setStep('error')
    }
  }

  const download = () => {
    if (!outputUrl) return
    const a = document.createElement('a')
    a.href = outputUrl
    a.download = `${themeName.toLowerCase().replace(/\s+/g, '-')}-montage.mp4`
    a.click()
  }

  const isProcessing = !['idle', 'done', 'error'].includes(step)
  const displayProgress = step === 'done' ? 100 : isProcessing ? Math.max(STEP_PROGRESS[step], progress) : 0

  return (
    <div className="border border-border p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-sans font-bold text-sm">Export MP4</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Transitions · Sous-titres · Intro · Format H264
          </p>
        </div>
        <div className="flex items-center gap-2">
          {step === 'done' && outputUrl && (
            <Button variant="outline" size="sm" onClick={download}>
              <Download size={12} />
              Télécharger
            </Button>
          )}
          {step !== 'done' && (
            <Button size="sm" onClick={run} disabled={isProcessing}>
              {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Scissors size={12} />}
              {isProcessing ? 'Traitement...' : 'Exporter'}
            </Button>
          )}
        </div>
      </div>

      {(isProcessing || step === 'done') && (
        <div className="flex flex-col gap-2">
          <Progress value={displayProgress} />
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              {STEP_LABELS[step]}
            </p>
            {detail && isProcessing && (
              <p className="text-[10px] font-mono text-muted-foreground/60">{detail}</p>
            )}
          </div>
        </div>
      )}

      {step === 'error' && (
        <p className="text-xs text-destructive font-mono">{error}</p>
      )}

      {step === 'idle' && (
        <p className="text-[10px] text-muted-foreground/50 font-mono">
          Inclut les transitions, sous-titres et l&apos;intro — traitement 100% local.
        </p>
      )}
    </div>
  )
}
