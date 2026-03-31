export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return new Response('Missing API key', { status: 500 })

  const { voiceId } = await req.json()
  if (!voiceId) return new Response('voiceId required', { status: 400 })

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
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return new Response('Missing API key', { status: 500 })

  const { searchParams } = new URL(req.url)
  const language = searchParams.get('language')?.toLowerCase()

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
    cache: 'no-store',
  })

  if (!res.ok) return new Response('ElevenLabs error', { status: res.status })

  const data = await res.json() as {
    voices: Array<{ voice_id: string; name: string; preview_url: string; category: string; labels: Record<string, string> }>
  }

  const ALLOWED_VOICE_IDS = new Set([
    'Hy28BjVfgieDVMiyQpQe', 'MmafIMKg28Wr0yMh8CEB', 'KSyQzmsYhFbuOhqj1Xxv',
    'jGpnMdbhtKgQbVrYezOx', 'k1w1SeihHyKDJXr7nZRX',
  ])

  const voices = data.voices
    .filter(v => ALLOWED_VOICE_IDS.has(v.voice_id))
    .map((v) => ({
      id: v.voice_id,
      name: v.name,
      previewUrl: v.preview_url,
      category: v.category,
      accent: v.labels?.accent ?? '',
      gender: v.labels?.gender ?? '',
      language: v.labels?.language ?? '',
    }))

  return Response.json(voices)
}
