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

    // Use silencedetect to find silent ranges, then cut both audio+video together
    const detectResult = spawnSync(ffmpeg, [
      '-i', inputPath,
      '-af', `silencedetect=noise=${threshold}dB:duration=0.4`,
      '-f', 'null', '-',
    ], { timeout: 30_000 })

    const detectOutput = (detectResult.stderr?.toString() ?? '') + (detectResult.stdout?.toString() ?? '')

    // Parse silence intervals
    const silenceStarts = [...detectOutput.matchAll(/silence_start: ([\d.]+)/g)].map(m => parseFloat(m[1]))
    const silenceEnds = [...detectOutput.matchAll(/silence_end: ([\d.]+)/g)].map(m => parseFloat(m[1]))

    // Get total duration
    const durationMatch = detectOutput.match(/Duration: (\d+):(\d+):([\d.]+)/)
    const totalDuration = durationMatch
      ? parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseFloat(durationMatch[3])
      : null

    // Build keep intervals with 200ms padding around speech to avoid abrupt cuts
    const PAD = 0.2
    const keepIntervals: { start: number; end: number }[] = []
    let pos = 0
    for (let i = 0; i < silenceStarts.length; i++) {
      const segEnd = Math.min(silenceStarts[i] + PAD, totalDuration ?? silenceStarts[i] + PAD)
      if (segEnd > pos + 0.05) keepIntervals.push({ start: pos, end: segEnd })
      pos = Math.max(0, (silenceEnds[i] ?? silenceStarts[i]) - PAD)
    }
    if (totalDuration && pos < totalDuration - 0.05) keepIntervals.push({ start: pos, end: totalDuration })

    // If no silence detected, just remux
    if (keepIntervals.length === 0) {
      const remux = spawnSync(ffmpeg, [
        '-y', '-fflags', '+genpts', '-i', inputPath,
        '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', outputPath,
      ], { timeout: 60_000 })
      if (remux.status !== 0) throw new Error(`FFmpeg remux failed: ${remux.stderr?.toString().slice(-300)}`)
      return Response.json({ id })
    }

    // Build filtergraph: trim each keep interval for video and audio, then concat
    const vParts = keepIntervals.map((seg, i) => `[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS[v${i}]`).join(';')
    const aParts = keepIntervals.map((seg, i) => `[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[a${i}]`).join(';')
    const vInputs = keepIntervals.map((_, i) => `[v${i}]`).join('')
    const aInputs = keepIntervals.map((_, i) => `[a${i}]`).join('')
    const n = keepIntervals.length
    const filterComplex = `${vParts};${aParts};${vInputs}concat=n=${n}:v=1:a=0[vout];${aInputs}concat=n=${n}:v=0:a=1[aout]`

    const result = spawnSync(ffmpeg, [
      '-y', '-i', inputPath,
      '-filter_complex', filterComplex,
      '-map', '[vout]', '-map', '[aout]',
      '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart',
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
