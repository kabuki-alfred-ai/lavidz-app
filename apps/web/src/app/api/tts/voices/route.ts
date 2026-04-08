import { isMiniMax, stripMiniMaxPrefix, fetchMiniMaxVoices } from '@/lib/tts-provider'

const ALLOWED_VOICE_IDS = new Set([
  'Hy28BjVfgieDVMiyQpQe', 'MmafIMKg28Wr0yMh8CEB', 'KSyQzmsYhFbuOhqj1Xxv',
  'jGpnMdbhtKgQbVrYezOx', 'k1w1SeihHyKDJXr7nZRX',
])

export async function POST(req: Request) {
  const { voiceId } = await req.json()
  if (!voiceId) return new Response('voiceId required', { status: 400 })

  // ─── MiniMax branch ───────────────────────────────────────────────────────
  // MiniMax doesn't expose a reliable voice list endpoint — return metadata directly
  // without calling the list API. The voice_id is used as-is in T2A v2.
  if (isMiniMax(voiceId)) {
    const rawId = stripMiniMaxPrefix(voiceId)
    return Response.json({ id: voiceId, name: rawId, previewUrl: '', category: 'minimax', accent: '', gender: '', language: '' })
  }

  // ─── ElevenLabs branch ────────────────────────────────────────────────────
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return new Response('Missing API key', { status: 500 })

  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    headers: { 'xi-api-key': apiKey },
    cache: 'no-store',
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(`ElevenLabs error: ${err}`, { status: res.status })
  }

  const v = await res.json() as { voice_id: string; name: string; preview_url: string; category: string; labels: Record<string, string> }
  return Response.json({
    id: v.voice_id,
    name: v.name,
    previewUrl: v.preview_url,
    category: v.category,
    accent: v.labels?.accent ?? '',
    gender: v.labels?.gender ?? '',
    language: v.labels?.language ?? '',
  })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const language = searchParams.get('language')?.toLowerCase()

  const apiKey = process.env.ELEVENLABS_API_KEY

  // ─── ElevenLabs voices ────────────────────────────────────────────────────
  let elVoices: Array<{ id: string; name: string; previewUrl: string; category: string; accent: string; gender: string; language: string }> = []
  if (apiKey) {
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json() as {
          voices: Array<{ voice_id: string; name: string; preview_url: string; category: string; labels: Record<string, string> }>
        }
        elVoices = data.voices
          .filter(v => ALLOWED_VOICE_IDS.has(v.voice_id))
          .map(v => ({
            id: v.voice_id,
            name: v.name,
            previewUrl: v.preview_url,
            category: v.category,
            accent: v.labels?.accent ?? '',
            gender: v.labels?.gender ?? '',
            language: v.labels?.language ?? '',
          }))
      }
    } catch {
      // non-blocking
    }
  }

  // ─── MiniMax voices (French only) ────────────────────────────────────────
  const mmVoices = (await fetchMiniMaxVoices()).filter(v => stripMiniMaxPrefix(v.id).startsWith('French_'))

  let voices = [...elVoices, ...mmVoices]

  if (language) {
    voices = voices.filter(v => !v.language || v.language.toLowerCase().includes(language))
  }

  return Response.json(voices)
}
