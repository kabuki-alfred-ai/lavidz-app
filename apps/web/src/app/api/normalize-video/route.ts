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
  let { videoUrl } = await req.json()
  if (videoUrl.startsWith('/')) {
    const origin = req.headers.get('origin') ?? `http://${req.headers.get('host')}`
    videoUrl = `${origin}${videoUrl}`
  }

  const ffmpeg = findFfmpeg()
  if (!ffmpeg) {
    // Graceful fallback: return original URL if FFmpeg not available
    return Response.json({ url: videoUrl, normalized: false })
  }

  const id = crypto.randomUUID()
  const inputPath = path.join('/tmp', `norm-input-${id}`)
  const outputPath = path.join('/tmp', `norm-output-${id}.mp4`)

  try {
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Download failed (${videoRes.status})`)
    fs.writeFileSync(inputPath, Buffer.from(await videoRes.arrayBuffer()))

    // Remux to MP4 with regenerated timestamps — fixes WebM A/V sync issues
    // Re-encode video to H264 for broad compatibility (VP8/VP9 don't embed well in MP4)
    const result = spawnSync(ffmpeg, [
      '-y',
      '-fflags', '+genpts',
      '-i', inputPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputPath,
    ], { timeout: 60_000 })

    if (result.status !== 0) {
      return Response.json({ url: videoUrl, normalized: false })
    }

    // Store the normalized file and return its serving ID
    const serveId = id
    return Response.json({ id: serveId, normalized: true })
  } finally {
    try { fs.unlinkSync(inputPath) } catch {}
  }
}
