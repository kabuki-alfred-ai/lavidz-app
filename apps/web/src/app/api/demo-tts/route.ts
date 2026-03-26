import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const DEMO_VOICE_ID = 'KSyQzmsYhFbuOhqj1Xxv'
const DEMO_TEXT = "Qu'attendez-vous pour faire du contenu rapidement ?"
const CACHE_DIR = path.join(process.cwd(), 'public', 'demo')
const CACHE_FILE = path.join(CACHE_DIR, 'demo-question.mp3')

export async function GET() {
  // Serve from cache if exists
  if (existsSync(CACHE_FILE)) {
    const audio = readFileSync(CACHE_FILE)
    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  // Generate once via ElevenLabs
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return new Response('Missing ElevenLabs API key', { status: 500 })
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${DEMO_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: DEMO_TEXT,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.1 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(`ElevenLabs error: ${err}`, { status: res.status })
  }

  const audio = Buffer.from(await res.arrayBuffer())

  // Cache to disk
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(CACHE_FILE, audio)
  } catch (e) {
    console.error('Failed to cache demo TTS:', e)
  }

  return new Response(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
