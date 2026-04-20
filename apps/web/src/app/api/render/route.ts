import os from 'os'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { purgeStaleTmpFiles } from '@/lib/tmp-cleanup'
import { isMiniMax, generateMiniMaxTTS } from '@/lib/tts-provider'

export const runtime = 'nodejs'
export const maxDuration = 600

let cachedBundle: string | null = null

const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'

import { setJob, getJob } from './jobs-store'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const { size } = await fs.promises.stat(filePath)
  const stream = fs.createReadStream(filePath)
  const s3 = getS3Client()
  const bucket = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: stream,
    ContentLength: size,
    ContentType: 'video/mp4',
  }))
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

const END_CARD_FRAMES = 150 // 5 seconds at 30fps

function calcTotalFrames(segments: any[], questionCardFrames: number, intro: any, outro: any, fps: number) {
  let total = 0
  if (intro?.enabled && intro?.hookText) total += Math.round(intro.durationSeconds * fps)
  for (const s of segments) total += (s.questionDurationFrames ?? questionCardFrames) + s.videoDurationFrames
  if (outro?.enabled && (outro?.ctaText || outro?.subText || outro?.logoUrl)) total += Math.round(outro.durationSeconds * fps)
  total += END_CARD_FRAMES
  return Math.max(total, 1)
}

async function generateTTS(text: string, voiceId: string, elevenLabsApiKey: string): Promise<Buffer | null> {
  // ─── MiniMax branch ─────────────────────────────────────────────────────
  if (isMiniMax(voiceId)) {
    return generateMiniMaxTTS(text, voiceId)
  }

  // ─── ElevenLabs branch ──────────────────────────────────────────────────
  const tryVoice = async (vid: string) => fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: 'POST',
    headers: { 'xi-api-key': elevenLabsApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.1 } }),
  })

  let res = await tryVoice(voiceId)
  if (res.status === 402 && voiceId !== DEFAULT_VOICE_ID) res = await tryVoice(DEFAULT_VOICE_ID)
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}

// ─── TTS batch helper: max 3 concurrent requests to avoid ElevenLabs 429 ─────
async function generateTTSBatched(
  segments: any[],
  voiceId: string,
  apiKey: string,
): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(segments.length).fill(null)
  const BATCH_SIZE = 3

  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    const batch = segments.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (seg: any) => {
        if (!seg.questionText || !apiKey) return null
        const audio = await generateTTS(seg.questionText, voiceId ?? DEFAULT_VOICE_ID, apiKey)
        if (!audio) return null
        const id = crypto.randomUUID()
        await fs.promises.writeFile(path.join('/tmp', `tts-render-${id}.mp3`), audio)
        return id
      })
    )
    batchResults.forEach((r, j) => { results[i + j] = r })
  }

  return results
}

async function runRender(jobId: string, body: any) {
  const { segments, questionCardFrames, subtitleSettings, theme, intro, outro, fps, width, height, voiceId, origin, sessionId, motionSettings, audioSettings } = body
  const apiKey = process.env.ELEVENLABS_API_KEY ?? ''
  const ttsIds: (string | null)[] = []

  const setProgress = async (p: number) => {
    const job = await getJob(jobId)
    if (job) await setJob(jobId, { ...job, progress: p })
  }

  try {
    await setProgress(2)

    // Generate TTS server-side — max 3 concurrent to avoid ElevenLabs 429
    const generatedIds = await generateTTSBatched(segments, voiceId ?? DEFAULT_VOICE_ID, apiKey)
    ttsIds.push(...generatedIds)

    // Re-sign expired presigned S3 video URLs (X-Amz-Expires=3600 — expires after 1h)
    const resolveVideoUrl = async (url: string | undefined): Promise<string | undefined> => {
      if (!url) return url
      if (url.startsWith('/')) return `${origin}${url}`
      if (url.includes('X-Amz-Signature')) {
        try {
          const parsed = new URL(url)
          const bucket = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'
          const pathParts = parsed.pathname.replace(/^\//, '').split('/')
          const key = pathParts[0] === bucket ? pathParts.slice(1).join('/') : pathParts.join('/')
          const s3 = getS3Client()
          return await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 43200 })
        } catch {
          return url
        }
      }
      return url
    }

    const serverSegments = await Promise.all(segments.map(async (seg: any, i: number) => ({
      ...seg,
      videoUrl: await resolveVideoUrl(seg.videoUrl),
      ttsUrl: ttsIds[i] ? `${origin}/api/tts-asset/${ttsIds[i]}` : null,
    })))

    await setProgress(10)

    if (!cachedBundle) {
      cachedBundle = await bundle({ entryPoint: path.join(process.cwd(), 'src/remotion/Root.tsx'), onProgress: () => {} })
    }

    await setProgress(15)

    // Resolve sound URLs: handle both relative proxy URLs and legacy presigned S3 URLs
    // Legacy presigned URLs contain X-Amz- params and may have expired — re-sign them
    const resolveSoundUrl = async (url: string | undefined): Promise<string | undefined> => {
      if (!url) return url
      // Relative proxy URL — make absolute
      if (url.startsWith('/')) return `${origin}${url}`
      // Presigned S3 URL that may have expired — extract key and re-sign with 12h expiry
      if (url.includes('X-Amz-Signature')) {
        try {
          const parsed = new URL(url)
          // Path format: /bucket/key or /key depending on path style
          // e.g. /lavidz-videos/sounds/uuid.wav → key = sounds/uuid.wav
          const bucket = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'
          const pathParts = parsed.pathname.replace(/^\//, '').split('/')
          // If first segment = bucket name, strip it
          const key = pathParts[0] === bucket ? pathParts.slice(1).join('/') : pathParts.join('/')
          const s3 = getS3Client()
          return await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 43200 })
        } catch {
          return url // fallback: return original, let Remotion fail naturally
        }
      }
      return url
    }

    const resolvedAudioSettings = audioSettings ? {
      ...audioSettings,
      bgMusic:       audioSettings.bgMusic       ? { ...audioSettings.bgMusic,       url: await resolveSoundUrl(audioSettings.bgMusic.url) }       : undefined,
      transitionSfx: audioSettings.transitionSfx ? { ...audioSettings.transitionSfx, url: await resolveSoundUrl(audioSettings.transitionSfx.url) } : undefined,
      introSfx:      audioSettings.introSfx      ? { ...audioSettings.introSfx,      url: await resolveSoundUrl(audioSettings.introSfx.url) }      : undefined,
      outroSfx:      audioSettings.outroSfx      ? { ...audioSettings.outroSfx,      url: await resolveSoundUrl(audioSettings.outroSfx.url) }      : undefined,
    } : audioSettings

    // Resolve cold open SFX URLs (motionSettings.coldOpen) — same logic as audioSettings
    let resolvedMotionSettings = motionSettings
    if (motionSettings?.coldOpen) {
      const co = motionSettings.coldOpen
      resolvedMotionSettings = {
        ...motionSettings,
        coldOpen: {
          ...co,
          coldOpenSfx: co.coldOpenSfx ? { ...co.coldOpenSfx, url: await resolveSoundUrl(co.coldOpenSfx.url) ?? co.coldOpenSfx.url } : undefined,
          entrySfx:    co.entrySfx    ? { ...co.entrySfx,    url: await resolveSoundUrl(co.entrySfx.url)    ?? co.entrySfx.url    } : undefined,
        },
      }
    }

    const totalFrames = calcTotalFrames(serverSegments, questionCardFrames, intro, outro, fps)
    const inputProps = { segments: serverSegments, questionCardFrames, subtitleSettings, theme, intro, outro, fps, motionSettings: resolvedMotionSettings, audioSettings: resolvedAudioSettings }

    const composition = await selectComposition({ serveUrl: cachedBundle, id: 'LavidzComposition', inputProps })
    const comp = { ...composition, width: width ?? composition.width, height: height ?? composition.height, durationInFrames: totalFrames, fps }

    const outputPath = path.join('/tmp', `render-${jobId}.mp4`)

    // Timeout: fail the render if it takes more than 8 minutes
    const RENDER_TIMEOUT_MS = 25 * 60 * 1000 // 25 min — covers long compositions
    const renderTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Render timeout after 25 minutes')), RENDER_TIMEOUT_MS)
    )

    await Promise.race([
      renderMedia({
        composition: comp,
        serveUrl: cachedBundle,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
        concurrency: Math.max(1, Math.floor((os.cpus().length ?? 2) * 0.75)),
        timeoutInMilliseconds: 120_000,
        onProgress: ({ progress }) => {
          setProgress(15 + Math.round(progress * 83))
        },
      }),
      renderTimeout,
    ])

    // Cleanup TTS files
    await Promise.all(
      ttsIds.map(id => id ? fs.promises.unlink(path.join('/tmp', `tts-render-${id}.mp3`)).catch(() => {}) : Promise.resolve())
    )

    // If sessionId provided, upload final video to S3 and update session
    if (sessionId) {
      try {
        const key = await uploadFinalToS3(outputPath, sessionId)
        await notifySessionFinalKey(sessionId, key)
      } catch (uploadErr) {
        console.error('Failed to upload final video to S3:', uploadErr)
      }
    }

    await setJob(jobId, { progress: 100, done: true, outputPath, sessionId: sessionId ?? null, error: null })
  } catch (err) {
    // Cleanup TTS files on error
    await Promise.all(
      ttsIds.map(id => id ? fs.promises.unlink(path.join('/tmp', `tts-render-${id}.mp3`)).catch(() => {}) : Promise.resolve())
    )
    await setJob(jobId, { progress: 0, done: true, outputPath: null, sessionId: sessionId ?? null, error: String(err) })
  }
}

export async function POST(req: Request) {
  purgeStaleTmpFiles('render-')
  purgeStaleTmpFiles('tts-render-')
  try {
    const body = await req.json()
    const jobId = crypto.randomUUID()
    await setJob(jobId, { progress: 0, done: false, outputPath: null, sessionId: body.sessionId ?? null, error: null })

    // Fire and forget — Vercel keeps the function alive (maxDuration: 600) while the render runs
    runRender(jobId, body)

    return Response.json({ jobId })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
