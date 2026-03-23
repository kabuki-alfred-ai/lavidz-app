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
    voices: Array<{ voice_id: string; name: string; preview_url: string; labels: Record<string, string> }>
  }

  const CREATOR_VOICE_IDS = [
    'odOFTFZU3DvAZ3EV3KHi',
    'KSyQzmsYhFbuOhqj1Xxv',
    'jGpnMdbhtKgQbVrYezOx',
    'nVPCtAFzgyMX3FZKNzH0',
    'jsScnYkNNda9Q1NES5nn',
  ]

  const allVoices = data.voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    previewUrl: v.preview_url,
    accent: v.labels?.accent ?? '',
    gender: v.labels?.gender ?? '',
    language: v.labels?.language ?? '',
  }))

  const voices = allVoices.filter(v => CREATOR_VOICE_IDS.includes(v.id))

  return Response.json(voices)
}
