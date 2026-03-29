import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { purgeStaleTmpFiles } from '@/lib/tmp-cleanup'

export const runtime = 'nodejs'
export const maxDuration = 180

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

// Resolve a proxy URL like /api/video/:id?sessionId=... to the actual S3 presigned URL.
// Cleanvoice rejects proxy URLs — it needs a direct link to the media file.
async function resolveToPresignedUrl(videoUrl: string): Promise<string> {
  const match = videoUrl.match(/\/api\/video\/([^/?]+)\?sessionId=([^&]+)/)
  if (!match) return videoUrl
  const [, recordingId, sessionId] = match
  const res = await fetch(`${API}/api/sessions/${sessionId}/recordings/${recordingId}/url`, {
    headers: { 'x-admin-secret': ADMIN_SECRET },
  })
  if (!res.ok) return videoUrl
  return res.text()
}

export interface CleanvoiceJobConfig {
  fillers: boolean
  hesitations: boolean
  stutters: boolean
  muted: boolean
  long_silences: boolean
  mouth_sounds: boolean
  remove_noise: boolean
  studio_sound: 'nightly' | false
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.CLEANVOICE_API_KEY
    if (!apiKey)
      return new Response("CLEANVOICE_API_KEY manquant — ajoutez-le dans les variables d'environnement", { status: 500 })

    let { videoUrl, config }: { videoUrl: string; config: CleanvoiceJobConfig } = await req.json()
    if (!videoUrl) return new Response('videoUrl required', { status: 400 })

    if (videoUrl.startsWith('/')) {
      const origin = req.headers.get('origin') ?? `http://${req.headers.get('host')}`
      videoUrl = `${origin}${videoUrl}`
    }

    // Resolve proxy URLs (/api/video/...) to the actual S3 presigned URL.
    // Cleanvoice rejects proxy/streaming URLs — it needs a direct link to the media file.
    videoUrl = await resolveToPresignedUrl(videoUrl)

    // Cleanvoice is an external service — it needs a publicly accessible URL.
    // If the URL points to localhost, rewrite it using APP_PUBLIC_URL (set in production env).
    if (/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(videoUrl)) {
      const publicBase = process.env.APP_PUBLIC_URL?.replace(/\/$/, '')
      if (!publicBase) {
        return new Response(
          "Cleanvoice nécessite une URL publique. Ajoutez APP_PUBLIC_URL=https://votre-domaine.com dans les variables d'environnement (Coolify), ou testez directement en production.",
          { status: 400 }
        )
      }
      videoUrl = videoUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, publicBase)
    }

    purgeStaleTmpFiles('cleanvoice-')
    const id = crypto.randomUUID()
    const outputPath = path.join('/tmp', `cleanvoice-${id}.mp4`)

    // Cleanvoice does not support WebM (browser MediaRecorder format).
    // If the source is WebM, download and convert to MP4 via FFmpeg,
    // then serve the converted file publicly so Cleanvoice can download it.
    const isWebm = /\.webm(\?|$)/i.test(videoUrl)
    if (isWebm) {
      const inputPath = path.join('/tmp', `cleanvoice-in-${id}.mp4`)
      const sourceRes = await fetch(videoUrl)
      if (!sourceRes.ok) return new Response(`Impossible de télécharger la vidéo source (${sourceRes.status})`, { status: 502 })
      fs.writeFileSync(inputPath, Buffer.from(await sourceRes.arrayBuffer()))
      execSync(`ffmpeg -y -i "${inputPath}" -c:v libx264 -c:a aac "${inputPath}.converted.mp4"`, { stdio: 'pipe' })
      fs.renameSync(`${inputPath}.converted.mp4`, inputPath)
      const origin = req.headers.get('origin') ?? `https://${req.headers.get('host')}`
      videoUrl = `${origin}/api/cleanvoice/input/${id}`
    }

    const editRes = await fetch('https://api.cleanvoice.ai/v2/edits', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          files: [videoUrl],
          config: {
            fillers: config.fillers ?? true,
            hesitations: config.hesitations ?? true,
            stutters: config.stutters ?? false,
            muted: config.muted ?? true,
            long_silences: config.long_silences ?? true,
            mouth_sounds: config.mouth_sounds ?? true,
            remove_noise: config.remove_noise ?? false,
            ...(config.studio_sound ? { studio_sound: config.studio_sound } : {}),
            video: true,
            transcription: true,
            export_format: 'mp4',
          },
        },
      }),
    })
    if (!editRes.ok) {
      const errText = await editRes.text()
      return new Response(`Cleanvoice submit error (${editRes.status}): ${errText}`, { status: 502 })
    }
    const { id: jobId } = await editRes.json()

    let jobResult: any = null
    for (let attempt = 0; attempt < 28; attempt++) {
      await new Promise(r => setTimeout(r, 5000))
      const statusRes = await fetch(`https://api.cleanvoice.ai/v2/edits/${jobId}`, {
        headers: { 'X-API-Key': apiKey },
      })
      const data = await statusRes.json()
      if (data.status === 'SUCCESS') { jobResult = data; break }
      if (data.status === 'FAILURE') return new Response(`Cleanvoice processing failed: ${JSON.stringify(data)}`, { status: 502 })
    }
    if (!jobResult) return new Response('Cleanvoice timeout — vidéo trop longue pour être traitée dans le délai imparti', { status: 504 })

    const downloadUrl = jobResult.audio?.download_url
    if (!downloadUrl) return new Response(`Cleanvoice: aucun lien de téléchargement dans la réponse: ${JSON.stringify(jobResult)}`, { status: 502 })

    const cleanedRes = await fetch(downloadUrl)
    if (!cleanedRes.ok) return new Response(`Impossible de télécharger la vidéo nettoyée (${cleanedRes.status})`, { status: 502 })
    fs.writeFileSync(outputPath, Buffer.from(await cleanedRes.arrayBuffer()))

    const rawWords: any[] = jobResult.transcript?.words ?? []
    const wordTimestamps = rawWords
      .map(w => ({
        word: (w.text ?? w.word ?? '') as string,
        start: (w.start ?? w.start_time ?? 0) as number,
        end: (w.end ?? w.end_time ?? 0) as number,
      }))
      .filter(w => w.word.trim().length > 0)

    const removed: number =
      jobResult.processing_stats?.filler_words_removed ??
      jobResult.audio?.statistics?.filler_sounds_removed ??
      0

    return Response.json({ id, removed, wordTimestamps })
  } catch (err) {
    console.error('[cleanvoice] error:', err)
    return new Response(`Cleanvoice erreur interne: ${String(err)}`, { status: 500 })
  }
}
