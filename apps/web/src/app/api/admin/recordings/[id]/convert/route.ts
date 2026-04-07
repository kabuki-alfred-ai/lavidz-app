import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { streamResponseToFile } from '@/lib/stream-file'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const runtime = 'nodejs'
export const maxDuration = 300

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

const FFMPEG_CANDIDATES = [
  process.env.FFMPEG_PATH,
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg',
  'ffmpeg',
].filter(Boolean) as string[]

function findFfmpeg(): string | null {
  for (const c of FFMPEG_CANDIDATES) {
    try { if (spawnSync(c, ['-version'], { timeout: 3000 }).status === 0) return c } catch {}
  }
  return null
}

// POST /api/admin/recordings/:id/convert?sessionId=...
// Converts a WebM recording to MP4 and updates rawVideoKey in DB
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(_req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return new Response('Missing sessionId', { status: 400 })

  const ffmpeg = findFfmpeg()
  if (!ffmpeg) return new Response('FFmpeg non disponible', { status: 500 })

  // Get recording info
  const sessionRes = await fetch(`${API}/api/sessions/${sessionId}`, {
    headers: { 'x-admin-secret': ADMIN_SECRET },
  })
  if (!sessionRes.ok) return new Response('Session introuvable', { status: 404 })
  const session = await sessionRes.json()
  const recording = session.recordings?.find((r: any) => r.id === id)
  if (!recording?.rawVideoKey) return new Response('Recording introuvable', { status: 404 })
  if (!recording.rawVideoKey.endsWith('.webm')) return Response.json({ alreadyMp4: true })

  // Get presigned URL
  const urlRes = await fetch(`${API}/api/sessions/${sessionId}/recordings/${id}/url`, {
    headers: { 'x-admin-secret': ADMIN_SECRET },
  })
  if (!urlRes.ok) return new Response('URL introuvable', { status: 502 })
  const signedUrl = (await urlRes.text()).replace(/^"|"$/g, '')

  const tmpInput = path.join('/tmp', `conv-in-${id}.webm`)
  const tmpOutput = path.join('/tmp', `conv-out-${id}.mp4`)

  try {
    // Download WebM
    const videoRes = await fetch(signedUrl)
    if (!videoRes.ok) return new Response('Téléchargement échoué', { status: 502 })
    await streamResponseToFile(videoRes, tmpInput)

    // Convert to MP4
    const result = spawnSync(ffmpeg, [
      '-y', '-fflags', '+genpts',
      '-i', tmpInput,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      tmpOutput,
    ], { timeout: 270_000 })

    if (result.status !== 0) {
      return new Response(`FFmpeg échoué: ${result.stderr?.toString()}`, { status: 500 })
    }

    // Upload MP4 to S3
    const mp4Key = recording.rawVideoKey.replace(/\.webm$/, '.mp4')
    const s3 = new S3Client({
      endpoint: process.env.RUSTFS_ENDPOINT ?? 'http://localhost:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? 'admin',
        secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? 'password123',
      },
      forcePathStyle: true,
    })
    const stat = fs.statSync(tmpOutput)
    await s3.send(new PutObjectCommand({
      Bucket: process.env.RUSTFS_BUCKET ?? 'lavidz-videos',
      Key: mp4Key,
      Body: fs.createReadStream(tmpOutput),
      ContentType: 'video/mp4',
      ContentLength: stat.size,
    }))

    // Update rawVideoKey in DB
    await fetch(`${API}/api/sessions/${sessionId}/recordings/${id}/raw-key`, {
      method: 'PATCH',
      headers: { 'x-admin-secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawVideoKey: mp4Key }),
    })

    return Response.json({ converted: true, mp4Key })
  } finally {
    try { fs.unlinkSync(tmpInput) } catch {}
    try { fs.unlinkSync(tmpOutput) } catch {}
  }
}
