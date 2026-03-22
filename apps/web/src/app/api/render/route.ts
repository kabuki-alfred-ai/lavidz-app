import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 600

let cachedBundle: string | null = null

const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'

import { jobs } from './jobs-store'

function calcTotalFrames(segments: any[], questionCardFrames: number, intro: any, fps: number) {
  let total = 0
  if (intro?.enabled && intro?.hookText) total += Math.round(intro.durationSeconds * fps)
  for (const s of segments) total += (s.questionDurationFrames ?? questionCardFrames) + s.videoDurationFrames
  return Math.max(total, 1)
}

async function generateTTS(text: string, voiceId: string, apiKey: string): Promise<Buffer | null> {
  const tryVoice = async (vid: string) => fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.1 } }),
  })

  let res = await tryVoice(voiceId)
  if (res.status === 402 && voiceId !== DEFAULT_VOICE_ID) res = await tryVoice(DEFAULT_VOICE_ID)
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}

async function runRender(jobId: string, body: any) {
  const { segments, questionCardFrames, subtitleSettings, theme, intro, fps, width, height, voiceId, origin } = body
  const apiKey = process.env.ELEVENLABS_API_KEY ?? ''

  const setProgress = (p: number) => {
    const job = jobs.get(jobId)
    if (job) jobs.set(jobId, { ...job, progress: p })
  }

  try {
    setProgress(2)

    // Generate TTS server-side
    const ttsIds: (string | null)[] = await Promise.all(
      segments.map(async (seg: any) => {
        if (!seg.questionText || !apiKey) return null
        const audio = await generateTTS(seg.questionText, voiceId ?? DEFAULT_VOICE_ID, apiKey)
        if (!audio) return null
        const id = crypto.randomUUID()
        fs.writeFileSync(path.join('/tmp', `tts-render-${id}.mp3`), audio)
        return id
      })
    )

    const serverSegments = segments.map((seg: any, i: number) => ({
      ...seg,
      ttsUrl: ttsIds[i] ? `${origin}/api/tts-asset/${ttsIds[i]}` : null,
    }))

    setProgress(10)

    if (!cachedBundle) {
      cachedBundle = await bundle({ entryPoint: path.join(process.cwd(), 'src/remotion/Root.tsx'), onProgress: () => {} })
    }

    setProgress(15)

    const totalFrames = calcTotalFrames(serverSegments, questionCardFrames, intro, fps)
    const inputProps = { segments: serverSegments, questionCardFrames, subtitleSettings, theme, intro, fps }

    const composition = await selectComposition({ serveUrl: cachedBundle, id: 'LavidzComposition', inputProps })
    const comp = { ...composition, width: width ?? composition.width, height: height ?? composition.height, durationInFrames: totalFrames, fps }

    const outputPath = path.join('/tmp', `render-${jobId}.mp4`)

    await renderMedia({
      composition: comp,
      serveUrl: cachedBundle,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      onProgress: ({ progress }) => {
        // progress: 0–1, map to 15–98
        setProgress(15 + Math.round(progress * 83))
      },
    })

    // Cleanup TTS
    for (const id of ttsIds) {
      if (id) try { fs.unlinkSync(path.join('/tmp', `tts-render-${id}.mp3`)) } catch {}
    }

    jobs.set(jobId, { progress: 100, done: true, outputPath, error: null })
  } catch (err) {
    jobs.set(jobId, { progress: 0, done: true, outputPath: null, error: String(err) })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const jobId = crypto.randomUUID()
    jobs.set(jobId, { progress: 0, done: false, outputPath: null, error: null })

    // Fire and forget
    runRender(jobId, body)

    return Response.json({ jobId })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
