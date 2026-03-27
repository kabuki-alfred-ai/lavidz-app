import { spawnSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Provider config ──────────────────────────────────────────────────────────
// TRANSCRIPTION_PROVIDER: 'groq' | 'openai'  (default: groq if key set, else openai)
// TRANSCRIPTION_MODEL: override model name (e.g. 'whisper-large-v3')

const PROVIDERS = {
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
    defaultModel: 'whisper-large-v3-turbo',
    apiKeyEnv: 'GROQ_API_KEY',
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    defaultModel: 'whisper-1',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
} as const

type ProviderKey = keyof typeof PROVIDERS

function resolveProvider(): { endpoint: string; model: string; apiKey: string; name: ProviderKey } {
  const forced = process.env.TRANSCRIPTION_PROVIDER as ProviderKey | undefined
  const modelOverride = process.env.TRANSCRIPTION_MODEL

  // Auto-select: groq if key present, else openai
  const name: ProviderKey = forced ?? (process.env.GROQ_API_KEY ? 'groq' : 'openai')
  const provider = PROVIDERS[name]
  const apiKey = process.env[provider.apiKeyEnv] ?? ''
  const model = modelOverride ?? provider.defaultModel

  return { endpoint: provider.endpoint, model, apiKey, name }
}

// ─── FFmpeg ───────────────────────────────────────────────────────────────────

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

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let { videoUrl } = await req.json()
  if (!videoUrl) return new Response('videoUrl requis', { status: 400 })

  if (videoUrl.startsWith('/')) {
    const origin = req.headers.get('origin') ?? `http://${req.headers.get('host')}`
    videoUrl = `${origin}${videoUrl}`
  }

  const { endpoint, model, apiKey, name } = resolveProvider()
  if (!apiKey) return new Response(`Clé API manquante pour le provider "${name}"`, { status: 500 })

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
      '-vn', '-ar', '16000', '-ac', '1', '-b:a', '64k',
      '-y', audioPath,
    ], { timeout: 60_000 })

    if (ffResult.status !== 0) throw new Error(`FFmpeg: ${ffResult.stderr?.toString()}`)
    if (!fs.existsSync(audioPath)) throw new Error('Fichier audio non généré')

    const audioBuffer = fs.readFileSync(audioPath)
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3')
    formData.append('model', model)
    formData.append('language', 'fr')
    formData.append('response_format', 'verbose_json')
    formData.append('timestamp_granularities[]', 'word')

    const whisperRes = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!whisperRes.ok) throw new Error(`${name} API error: ${await whisperRes.text()}`)

    const data = await whisperRes.json() as {
      text: string
      words?: { word: string; start: number; end: number }[]
    }

    const transcript = data.text.trim()
    const rawWords = data.words?.map(w => ({
      word: w.word.trim(),
      start: w.start,
      end: w.end,
    })) ?? []

    // Merge elided tokens: ["j'", "étais"] → ["j'étais"]
    const wordTimestamps: typeof rawWords = []
    for (let i = 0; i < rawWords.length; i++) {
      const w = rawWords[i]
      if (w.word.endsWith("'") && i + 1 < rawWords.length) {
        wordTimestamps.push({ word: w.word + rawWords[i + 1].word, start: w.start, end: rawWords[i + 1].end })
        i++
      } else {
        wordTimestamps.push(w)
      }
    }

    return Response.json({ transcript, wordTimestamps, provider: name, model })

  } catch (err) {
    return new Response(String(err), { status: 500 })
  } finally {
    try { fs.unlinkSync(inputPath) } catch {}
    try { fs.unlinkSync(audioPath) } catch {}
  }
}
