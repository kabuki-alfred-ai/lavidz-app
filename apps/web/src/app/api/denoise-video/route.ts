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

const FILTERS: Record<string, string> = {
  light:    'afftdn=nf=-15',
  moderate: 'highpass=f=100,afftdn=nf=-25,loudnorm',
  strong:   'highpass=f=200,afftdn=nf=-35,loudnorm',
}

async function isolateWithElevenLabs(
  ffmpeg: string,
  inputPath: string,
  outputPath: string,
  id: string,
): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY manquant')

  // 1. Extract audio as WAV
  const audioPath = path.join('/tmp', `dn-audio-${id}.wav`)
  const extractResult = spawnSync(ffmpeg, [
    '-y', '-i', inputPath,
    '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '1',
    audioPath,
  ], { timeout: 60_000 })
  if (extractResult.status !== 0) {
    throw new Error(`Extraction audio échouée: ${extractResult.stderr?.toString().slice(-300)}`)
  }

  try {
    // 2. Send to ElevenLabs Audio Isolation
    const audioBuffer = fs.readFileSync(audioPath)
    const formData = new FormData()
    formData.append('audio', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav')

    const elRes = await fetch('https://api.elevenlabs.io/v1/audio-isolation', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: formData,
    })
    if (!elRes.ok) {
      const errText = await elRes.text()
      throw new Error(`ElevenLabs Voice Isolator error (${elRes.status}): ${errText.slice(0, 200)}`)
    }

    // 3. Save isolated audio
    const isolatedPath = path.join('/tmp', `dn-isolated-${id}.mp3`)
    fs.writeFileSync(isolatedPath, Buffer.from(await elRes.arrayBuffer()))

    try {
      // 4. Merge isolated audio back into video (replace audio track)
      const mergeResult = spawnSync(ffmpeg, [
        '-y',
        '-i', inputPath,
        '-i', isolatedPath,
        '-c:v', 'copy',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:a', 'aac', '-b:a', '192k',
        '-shortest',
        outputPath,
      ], { timeout: 90_000 })
      if (mergeResult.status !== 0) {
        throw new Error(`Merge audio échoué: ${mergeResult.stderr?.toString().slice(-300)}`)
      }
    } finally {
      try { fs.unlinkSync(isolatedPath) } catch {}
    }
  } finally {
    try { fs.unlinkSync(audioPath) } catch {}
  }
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

  const id = crypto.randomUUID()
  const inputPath = path.join('/tmp', `dn-input-${id}`)
  const outputPath = path.join('/tmp', `denoise-${id}.mp4`)

  try {
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Téléchargement échoué (${videoRes.status})`)
    fs.writeFileSync(inputPath, Buffer.from(await videoRes.arrayBuffer()))

    if (strength === 'isolate') {
      await isolateWithElevenLabs(ffmpeg, inputPath, outputPath, id)
    } else {
      const filter = FILTERS[strength] ?? FILTERS.moderate
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
    }

    return Response.json({ id })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  } finally {
    try { fs.unlinkSync(inputPath) } catch {}
  }
}
