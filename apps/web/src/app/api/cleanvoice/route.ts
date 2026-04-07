import crypto from 'crypto'
import { purgeStaleTmpFiles } from '@/lib/tmp-cleanup'

export const runtime = 'nodejs'
export const maxDuration = 120

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

// Resolve a proxy URL like /api/video/:id?sessionId=... to the actual S3 presigned URL.
// Cleanvoice rejects proxy/streaming URLs — it needs a direct link to the media file.
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
  breath: boolean
  remove_noise: boolean
  normalize: boolean
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
            breath: config.breath ?? true,
            remove_noise: config.remove_noise ?? false,
            normalize: config.normalize ?? true,
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
    const { id: cleanvoiceJobId } = await editRes.json()

    // Return immediately — the client will poll /api/cleanvoice/status to track completion
    return Response.json({ cleanvoiceJobId, id })
  } catch (err) {
    console.error('[cleanvoice] error:', err)
    return new Response(`Cleanvoice erreur interne: ${String(err)}`, { status: 500 })
  }
}
