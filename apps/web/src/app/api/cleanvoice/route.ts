import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { purgeStaleTmpFiles } from '@/lib/tmp-cleanup'
import { streamResponseToFile } from '@/lib/stream-file'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const runtime = 'nodejs'
export const maxDuration = 120

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''
const BUCKET = process.env.RUSTFS_BUCKET ?? 'lavidz-videos'

async function uploadToS3AndPresign(filePath: string, key: string): Promise<string> {
  const uploadClient = new S3Client({
    endpoint: process.env.RUSTFS_ENDPOINT ?? 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? 'admin',
      secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? 'password123',
    },
    forcePathStyle: true,
  })
  const stat = fs.statSync(filePath)
  await uploadClient.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fs.createReadStream(filePath),
    ContentType: 'video/mp4',
    ContentLength: stat.size,
  }))

  // Use public endpoint for presigned URL so Cleanvoice can reach it
  const presignClient = new S3Client({
    endpoint: process.env.RUSTFS_PUBLIC_ENDPOINT ?? process.env.RUSTFS_ENDPOINT ?? 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? 'admin',
      secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? 'password123',
    },
    forcePathStyle: true,
  })
  return getSignedUrl(presignClient, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 7200 })
}

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

    // Cleanvoice does not support WebM. Detect by content-type (more reliable than URL extension).
    // If not MP4, convert via FFmpeg before sending to Cleanvoice.
    const headRes = await fetch(videoUrl, { method: 'HEAD' })
    const contentType = headRes.headers.get('content-type') ?? ''
    const needsConversion = !contentType.includes('mp4') && !contentType.includes('h264')
    if (needsConversion) {
      const rawPath = path.join('/tmp', `cleanvoice-raw-${id}`)
      const convertedPath = path.join('/tmp', `cleanvoice-in-${id}.mp4`)
      try {
        const sourceRes = await fetch(videoUrl)
        if (!sourceRes.ok) return new Response(`Impossible de télécharger la vidéo source (${sourceRes.status})`, { status: 502 })
        await streamResponseToFile(sourceRes, rawPath)
        execSync(`ffmpeg -y -i "${rawPath}" -c:v libx264 -c:a aac "${convertedPath}"`, { stdio: 'pipe' })
        videoUrl = await uploadToS3AndPresign(convertedPath, `cleanvoice-tmp/${id}.mp4`)
      } finally {
        try { fs.unlinkSync(rawPath) } catch {}
        try { fs.unlinkSync(convertedPath) } catch {}
      }
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
