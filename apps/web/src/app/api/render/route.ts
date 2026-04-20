import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { purgeStaleTmpFiles } from '@/lib/tmp-cleanup'
import { isMiniMax, generateMiniMaxTTS } from '@/lib/tts-provider'
import { getInternalS3Client, getBucket } from '@/lib/s3'
import { streamResponseToFile } from '@/lib/stream-file'

export const runtime = 'nodejs'
export const maxDuration = 600

let cachedBundle: string | null = null

const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'

import { setJob, getJob } from './jobs-store'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadFinalToS3(filePath: string, sessionId: string): Promise<string> {
  const key = `sessions/${sessionId}/final.mp4`
  const { size } = await fs.promises.stat(filePath)
  const stream = fs.createReadStream(filePath)
  await getInternalS3Client().send(new PutObjectCommand({
    Bucket: getBucket(),
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

    // Download MinIO/remote assets to /tmp and serve them back via
    // http://localhost:3000/api/render-asset/{id}. This bypasses all Docker
    // network path issues (IPv6-only DNS + Chromium hang, HTTP/3 proxy bugs).
    // Remotion's Chromium fetches over the loopback (127.0.0.1, always IPv4).
    const renderOrigin = 'http://localhost:3000'
    const downloadToTmp = async (url: string): Promise<string | undefined> => {
      const assetId = crypto.randomUUID()
      const dest = path.join('/tmp', `render-asset-${assetId}.mp4`)
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`download ${res.status}`)
        await streamResponseToFile(res, dest)
        return `${renderOrigin}/api/render-asset/${assetId}`
      } catch (err) {
        console.error('[render] downloadToTmp failed for', url, err)
        return undefined
      }
    }

    const resolveVideoUrl = async (url: string | undefined): Promise<string | undefined> => {
      if (!url) return url
      if (url.startsWith('/')) return `${renderOrigin}${url}`
      // MinIO presigned or any http(s) URL — download + serve via loopback.
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const local = await downloadToTmp(url)
        if (local) return local
      }
      return url
    }

    const serverSegments = await Promise.all(segments.map(async (seg: any, i: number) => ({
      ...seg,
      videoUrl: await resolveVideoUrl(seg.videoUrl),
      ttsUrl: ttsIds[i] ? `${renderOrigin}/api/tts-asset/${ttsIds[i]}` : null,
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
      if (url.startsWith('/')) return `${renderOrigin}${url}`
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const local = await downloadToTmp(url)
        if (local) return local
      }
      return url
    }

    // Resolve all sound URLs in parallel (previously sequential ~seconds saved)
    const [bgMusicUrl, transitionSfxUrl, introSfxUrl, outroSfxUrl] = audioSettings ? await Promise.all([
      audioSettings.bgMusic       ? resolveSoundUrl(audioSettings.bgMusic.url)       : Promise.resolve(undefined),
      audioSettings.transitionSfx ? resolveSoundUrl(audioSettings.transitionSfx.url) : Promise.resolve(undefined),
      audioSettings.introSfx      ? resolveSoundUrl(audioSettings.introSfx.url)      : Promise.resolve(undefined),
      audioSettings.outroSfx      ? resolveSoundUrl(audioSettings.outroSfx.url)      : Promise.resolve(undefined),
    ]) : [undefined, undefined, undefined, undefined]

    const resolvedAudioSettings = audioSettings ? {
      ...audioSettings,
      bgMusic:       audioSettings.bgMusic       ? { ...audioSettings.bgMusic,       url: bgMusicUrl }       : undefined,
      transitionSfx: audioSettings.transitionSfx ? { ...audioSettings.transitionSfx, url: transitionSfxUrl } : undefined,
      introSfx:      audioSettings.introSfx      ? { ...audioSettings.introSfx,      url: introSfxUrl }      : undefined,
      outroSfx:      audioSettings.outroSfx      ? { ...audioSettings.outroSfx,      url: outroSfxUrl }      : undefined,
    } : audioSettings

    // Resolve cold open SFX URLs (motionSettings.coldOpen) — parallel
    let resolvedMotionSettings = motionSettings
    if (motionSettings?.coldOpen) {
      const co = motionSettings.coldOpen
      const [coldOpenSfxUrl, entrySfxUrl] = await Promise.all([
        co.coldOpenSfx ? resolveSoundUrl(co.coldOpenSfx.url) : Promise.resolve(undefined),
        co.entrySfx    ? resolveSoundUrl(co.entrySfx.url)    : Promise.resolve(undefined),
      ])
      resolvedMotionSettings = {
        ...motionSettings,
        coldOpen: {
          ...co,
          coldOpenSfx: co.coldOpenSfx ? { ...co.coldOpenSfx, url: coldOpenSfxUrl ?? co.coldOpenSfx.url } : undefined,
          entrySfx:    co.entrySfx    ? { ...co.entrySfx,    url: entrySfxUrl    ?? co.entrySfx.url    } : undefined,
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
        // null lets Remotion auto-tune concurrency (≈ cores). Manual 0.75× was leaving
        // CPU headroom that the renderer could otherwise use.
        concurrency: null,
        // 'veryfast' x264 preset: ~2-3× encode speed vs default 'medium', same CRF.
        // Quality loss is imperceptible for social-media content.
        x264Preset: 'veryfast',
        // Lower intermediate JPEG quality: faster disk I/O between Chromium and encoder.
        jpegQuality: 70,
        // Allow Chromium hardware decoding when host supports it (no-op otherwise).
        hardwareAcceleration: 'if-possible',
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
