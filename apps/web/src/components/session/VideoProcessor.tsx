'use client'

import { useState, useRef } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Scissors, Download, Loader2 } from 'lucide-react'

interface Props {
  recordings: Array<{
    id: string
    questionText: string
    videoUrl: string
    transcript: string | null
  }>
  themeName: string
}

type ProcessingStep =
  | 'idle'
  | 'loading-ffmpeg'
  | 'downloading'
  | 'removing-silence'
  | 'adding-subtitles'
  | 'concatenating'
  | 'done'
  | 'error'

const STEP_LABELS: Record<ProcessingStep, string> = {
  'idle': '',
  'loading-ffmpeg': 'Chargement du moteur vidéo...',
  'downloading': 'Téléchargement des vidéos...',
  'removing-silence': 'Suppression des silences...',
  'adding-subtitles': 'Ajout des sous-titres...',
  'concatenating': 'Assemblage final...',
  'done': 'Vidéo prête !',
  'error': 'Erreur de traitement',
}

const STEP_PROGRESS: Record<ProcessingStep, number> = {
  'idle': 0,
  'loading-ffmpeg': 10,
  'downloading': 25,
  'removing-silence': 50,
  'adding-subtitles': 70,
  'concatenating': 90,
  'done': 100,
  'error': 0,
}

export function VideoProcessor({ recordings, themeName }: Props) {
  const [step, setStep] = useState<ProcessingStep>('idle')
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const ffmpegRef = useRef<FFmpeg | null>(null)

  const process = async () => {
    setError('')
    setOutputUrl(null)

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

      // 2. Download all videos
      setStep('downloading')
      const inputFiles: string[] = []

      for (let i = 0; i < recordings.length; i++) {
        const rec = recordings[i]
        const data = await fetchFile(rec.videoUrl)
        const filename = `input_${i}.webm`
        await ffmpeg.writeFile(filename, data)
        inputFiles.push(filename)
      }

      // 3. Remove silence from each clip
      setStep('removing-silence')
      const processedFiles: string[] = []

      for (let i = 0; i < inputFiles.length; i++) {
        const input = inputFiles[i]
        const output = `processed_${i}.mp4`

        await ffmpeg.exec([
          '-i', input,
          '-af', 'silenceremove=stop_periods=-1:stop_duration=0.8:stop_threshold=-40dB',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          '-y', output,
        ])
        processedFiles.push(output)
      }

      // 4. Add subtitles if transcript available
      setStep('adding-subtitles')
      const subtitledFiles: string[] = []

      for (let i = 0; i < processedFiles.length; i++) {
        const rec = recordings[i]
        const input = processedFiles[i]
        const output = `subtitled_${i}.mp4`

        if (rec.transcript) {
          const srt = transcriptToSrt(rec.transcript)
          await ffmpeg.writeFile(`sub_${i}.srt`, srt)

          await ffmpeg.exec([
            '-i', input,
            '-vf', `subtitles=sub_${i}.srt:force_style='FontName=Arial,FontSize=14,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Alignment=2'`,
            '-c:a', 'copy',
            '-y', output,
          ])
          subtitledFiles.push(output)
        } else {
          subtitledFiles.push(input)
        }
      }

      // 5. Concatenate all clips
      setStep('concatenating')

      if (subtitledFiles.length === 1) {
        const data = await ffmpeg.readFile(subtitledFiles[0])
        const blob = new Blob([data as BlobPart], { type: 'video/mp4' })
        setOutputUrl(URL.createObjectURL(blob))
      } else {
        const concatList = subtitledFiles.map((f) => `file '${f}'`).join('\n')
        await ffmpeg.writeFile('concat.txt', concatList)

        await ffmpeg.exec([
          '-f', 'concat',
          '-safe', '0',
          '-i', 'concat.txt',
          '-c', 'copy',
          '-y', 'output.mp4',
        ])

        const data = await ffmpeg.readFile('output.mp4')
        const blob = new Blob([data as BlobPart], { type: 'video/mp4' })
        setOutputUrl(URL.createObjectURL(blob))
      }

      setStep('done')
    } catch (err) {
      console.error('FFmpeg error:', err)
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

  return (
    <div className="border border-border p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-sans font-bold text-sm">Montage automatique</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suppression des silences · Sous-titres · Export MP4
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
            <Button
              size="sm"
              onClick={process}
              disabled={isProcessing || recordings.length === 0}
            >
              {isProcessing
                ? <Loader2 size={12} className="animate-spin" />
                : <Scissors size={12} />
              }
              {isProcessing ? 'Traitement...' : 'Lancer le montage'}
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {(isProcessing || step === 'done') && (
        <div className="flex flex-col gap-2">
          <Progress value={STEP_PROGRESS[step]} />
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            {STEP_LABELS[step]}
          </p>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <p className="text-xs text-destructive font-mono">{error}</p>
      )}

      {/* Preview */}
      {outputUrl && (
        <video
          src={outputUrl}
          controls
          className="w-full border border-border bg-black"
          style={{ aspectRatio: '16/9' }}
        />
      )}

      {/* Note */}
      {step === 'idle' && (
        <p className="text-[10px] text-muted-foreground/50 font-mono">
          Le traitement se fait entièrement dans votre navigateur — aucune vidéo n&apos;est envoyée sur nos serveurs.
        </p>
      )}
    </div>
  )
}

function transcriptToSrt(text: string): string {
  const words = text.split(' ').filter(Boolean)
  const wordsPerChunk = 6
  const secondsPerChunk = 3
  const chunks: string[] = []

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
  }

  return chunks
    .map((chunk, i) => {
      const start = i * secondsPerChunk
      const end = start + secondsPerChunk
      return `${i + 1}\n${toSrtTime(start)} --> ${toSrtTime(end)}\n${chunk}`
    })
    .join('\n\n')
}

function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = 0
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
