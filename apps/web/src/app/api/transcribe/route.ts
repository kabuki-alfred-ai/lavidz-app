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
  if (!videoUrl) return new Response('videoUrl requis', { status: 400 })

  if (videoUrl.startsWith('/')) {
    const origin = req.headers.get('origin') ?? `http://${req.headers.get('host')}`
    videoUrl = `${origin}${videoUrl}`
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return new Response('OPENAI_API_KEY non configuré', { status: 500 })

  const ffmpeg = findFfmpeg()
  if (!ffmpeg) return new Response('FFmpeg introuvable', { status: 500 })

  const id = crypto.randomUUID()
  const inputPath = path.join('/tmp', `tr-input-${id}`)
  const audioPath = path.join('/tmp', `tr-audio-${id}.mp3`)

  try {
    // Download video
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Téléchargement vidéo échoué (${videoRes.status})`)
    fs.writeFileSync(inputPath, Buffer.from(await videoRes.arrayBuffer()))

    // Extract audio: mono, 16kHz — optimal for Whisper
    const ffResult = spawnSync(ffmpeg, [
      '-i', inputPath,
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '64k',
      '-y', audioPath,
    ], { timeout: 60_000 })

    if (ffResult.status !== 0) {
      throw new Error(`FFmpeg audio extraction échouée: ${ffResult.stderr?.toString()}`)
    }

    if (!fs.existsSync(audioPath)) throw new Error('Fichier audio non généré')

    // Call OpenAI Whisper
    const audioBuffer = fs.readFileSync(audioPath)
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'verbose_json')
    formData.append('timestamp_granularities[]', 'word')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      throw new Error(`Whisper API error: ${err}`)
    }

    const data = await whisperRes.json() as {
      text: string
      words?: { word: string; start: number; end: number }[]
    }

    const transcript = data.text.trim()
    const wordTimestamps = data.words?.map(w => ({
      word: w.word.trim(),
      start: w.start,
      end: w.end,
    })) ?? []

    return Response.json({ transcript, wordTimestamps })

  } catch (err) {
    return new Response(String(err), { status: 500 })
  } finally {
    try { fs.unlinkSync(inputPath) } catch {}
    try { fs.unlinkSync(audioPath) } catch {}
  }
}
