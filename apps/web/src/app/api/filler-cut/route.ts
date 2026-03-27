import { spawnSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 180

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

// Mots fillers français à supprimer
const FILLER_WORDS = new Set([
  'euh', 'euhm', 'hm', 'hmm', 'hmmm', 'ah', 'eh', 'bah', 'ben',
  'um', 'uh', 'uhm', 'mm', 'mmm',
])

function isFiller(word: string): boolean {
  return FILLER_WORDS.has(word.toLowerCase().replace(/[^a-zàâäéèêëîïôùûüÿç]/g, ''))
}

export async function POST(req: Request) {
  if (!process.env.DEEPGRAM_API_KEY)
    return new Response('DEEPGRAM_API_KEY manquant — ajoutez-le dans les variables d\'environnement du service web', { status: 500 })

  let { videoUrl } = await req.json()
  if (!videoUrl) return new Response('videoUrl required', { status: 400 })

  if (videoUrl.startsWith('/')) {
    const origin = req.headers.get('origin') ?? `http://${req.headers.get('host')}`
    videoUrl = `${origin}${videoUrl}`
  }

  const ffmpeg = findFfmpeg()
  if (!ffmpeg) return new Response('FFmpeg introuvable', { status: 500 })

  const id = crypto.randomUUID()
  const inputPath = path.join('/tmp', `fc-input-${id}`)
  const outputPath = path.join('/tmp', `filler-cut-${id}.mp4`)

  try {
    // Download video
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Impossible de télécharger la vidéo (${videoRes.status})`)
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
    fs.writeFileSync(inputPath, videoBuffer)

    // Get word-level timestamps from Deepgram
    const dgRes = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=false&filler_words=true&words=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/webm',
        },
        body: videoBuffer,
      },
    )
    if (!dgRes.ok) throw new Error(`Deepgram error: ${dgRes.statusText}`)

    const dgResult = await dgRes.json() as any
    const words: { word: string; start: number; end: number }[] =
      dgResult?.results?.channels?.[0]?.alternatives?.[0]?.words ?? []

    // Get total duration from ffmpeg
    const probeResult = spawnSync(ffmpeg, ['-i', inputPath, '-f', 'null', '-'], { timeout: 10_000 })
    const probeOutput = (probeResult.stderr?.toString() ?? '')
    const durationMatch = probeOutput.match(/Duration: (\d+):(\d+):([\d.]+)/)
    const totalDuration = durationMatch
      ? parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseFloat(durationMatch[3])
      : (words.at(-1)?.end ?? 0) + 0.5

    // Build filler intervals to remove
    const fillerIntervals = words
      .filter(w => isFiller(w.word))
      .map(w => ({ start: Math.max(0, w.start - 0.05), end: Math.min(totalDuration, w.end + 0.05) }))

    if (fillerIntervals.length === 0) {
      // No fillers — just remux
      const remux = spawnSync(ffmpeg, [
        '-y', '-i', inputPath,
        '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', outputPath,
      ], { timeout: 60_000 })
      if (remux.status !== 0) throw new Error(`FFmpeg remux failed`)
      return Response.json({ id, removed: 0, keepIntervals: [{ start: 0, end: totalDuration }] })
    }

    // Build keep intervals (inverse of filler intervals)
    const keepIntervals: { start: number; end: number }[] = []
    let pos = 0
    for (const filler of fillerIntervals) {
      if (filler.start > pos + 0.02) keepIntervals.push({ start: pos, end: filler.start })
      pos = filler.end
    }
    if (pos < totalDuration - 0.02) keepIntervals.push({ start: pos, end: totalDuration })

    if (keepIntervals.length === 0) {
      return Response.json({ id: null, removed: fillerIntervals.length })
    }

    // Build ffmpeg filtergraph
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
    ], { timeout: 120_000 })

    if (result.status !== 0) throw new Error(`FFmpeg a échoué : ${result.stderr?.toString().slice(-500)}`)

    return Response.json({ id, removed: fillerIntervals.length, keepIntervals })
  } finally {
    try { fs.unlinkSync(inputPath) } catch {}
  }
}
