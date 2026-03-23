import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const runtime = 'nodejs'
export const maxDuration = 600

let cachedBundle: string | null = null

const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'

import { jobs } from './jobs-store'

function getS3Client() {
  return new S3Client({
    endpoint: process.env.RUSTFS_ENDPOINT ?? 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? 'admin',
      secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? 'password123',
    },
    forcePathStyle: true,
  })
}

async function uploadFinalToS3(filePath: string, sessionId: string): Promise<string> {
  const key = `sessions/${sessionId}/final.mp4`
  const buffer = fs.readFileSync(filePath)
  const s3 = getS3Client()
  const bucket = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: 'video/mp4' }))
  return key
}

async function notifySessionFinalKey(sessionId: string, key: string): Promise<void> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const adminSecret = process.env.ADMIN_SECRET ?? ''
  await fetch(`${apiUrl}/api/sessions/${sessionId}/final-video-key`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
    body: JSON.stringify({ key }),
  })
}

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
  const { segments, questionCardFrames, subtitleSettings, theme, intro, fps, width, height, voiceId, origin, sessionId, motionSettings, audioSettings } = body
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
    const inputProps = { segments: serverSegments, questionCardFrames, subtitleSettings, theme, intro, fps, motionSettings, audioSettings }

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

    // If sessionId provided, upload final video to S3 and update session
    if (sessionId) {
      try {
        const key = await uploadFinalToS3(outputPath, sessionId)
        await notifySessionFinalKey(sessionId, key)
      } catch (uploadErr) {
        console.error('Failed to upload final video to S3:', uploadErr)
      }
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
