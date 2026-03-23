import { spawnSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 120

const FFMPEG_CANDIDATES = [
  process.env.FFMPEG_PATH,
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/usr/bin/ffmpeg',
  'ffmpeg',
].filter(Boolean) as string[]

function findFfmpeg(): string | null {
  for (const candidate of FFMPEG_CANDIDATES) {
    try {
      const result = spawnSync(candidate, ['-version'], { timeout: 3000 })
      if (result.status === 0) return candidate
    } catch {}
  }
  return null
}

const FILTERS: Record<string, string> = {
  light:    'afftdn=nf=-15',
  moderate: 'highpass=f=100,afftdn=nf=-25,loudnorm',
  strong:   'highpass=f=200,afftdn=nf=-35,loudnorm',
}

export async function POST(req: Request) {
  let { videoUrl, strength = 'moderate' } = await req.json()
  if (!videoUrl) return new Response('videoUrl requis', { status: 400 })

  if (videoUrl.startsWith('/')) {
    const origin = req.headers.get('origin') ?? `http://${req.headers.get('host')}`
    videoUrl = `${origin}${videoUrl}`
  }

  const ffmpeg = findFfmpeg()
  if (!ffmpeg) return new Response('FFmpeg introuvable', { status: 500 })

  const filter = FILTERS[strength] ?? FILTERS.moderate
  const id = crypto.randomUUID()
  const inputPath = path.join('/tmp', `dn-input-${id}`)
  const outputPath = path.join('/tmp', `denoise-${id}.mp4`)

  try {
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Téléchargement échoué (${videoRes.status})`)
    fs.writeFileSync(inputPath, Buffer.from(await videoRes.arrayBuffer()))

    const result = spawnSync(ffmpeg, [
      '-y', '-i', inputPath,
      '-af', filter,
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k',
      outputPath,
    ], { timeout: 90_000 })

    if (result.status !== 0) {
      throw new Error(`FFmpeg denoise échoué: ${result.stderr?.toString().slice(-400)}`)
    }

    return Response.json({ id })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  } finally {
    try { fs.unlinkSync(inputPath) } catch {}
  }
}
