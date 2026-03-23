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

export async function POST(req: Request) {
  let { videoUrl, threshold = -35 } = await req.json()
  if (videoUrl.startsWith('/')) {
    const origin = req.headers.get('origin') ?? `http://${req.headers.get('host')}`
    videoUrl = `${origin}${videoUrl}`
  }

  const ffmpeg = findFfmpeg()
  if (!ffmpeg) {
    return new Response(
      'FFmpeg introuvable. Installez-le avec : brew install ffmpeg',
      { status: 500 }
    )
  }

  const id = crypto.randomUUID()
  const inputPath = path.join('/tmp', `sc-input-${id}`)
  const outputPath = path.join('/tmp', `silence-cut-${id}.mp4`)

  try {
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Impossible de télécharger la vidéo (${videoRes.status})`)
    fs.writeFileSync(inputPath, Buffer.from(await videoRes.arrayBuffer()))

    const result = spawnSync(ffmpeg, [
      '-y',
      '-fflags', '+genpts',
      '-i', inputPath,
      '-af', `silenceremove=start_periods=1:start_threshold=${threshold}dB:start_duration=0.1:stop_periods=-1:stop_threshold=${threshold}dB:stop_duration=0.4:detection=peak,aresample=async=1`,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-vsync', 'cfr',
      '-movflags', '+faststart',
      outputPath,
    ], { timeout: 60_000 })

    if (result.status !== 0) {
      const stderr = result.stderr?.toString() ?? ''
      throw new Error(`FFmpeg a échoué : ${stderr.slice(-500)}`)
    }

    return Response.json({ id })
  } finally {
    try { fs.unlinkSync(inputPath) } catch {}
  }
}
