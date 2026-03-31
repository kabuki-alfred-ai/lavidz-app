import { VoicesClient } from './VoicesClient'

async function fetchVoices() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return []

  const ALLOWED_VOICE_IDS = new Set([
    'Hy28BjVfgieDVMiyQpQe', 'MmafIMKg28Wr0yMh8CEB', 'KSyQzmsYhFbuOhqj1Xxv',
    'jGpnMdbhtKgQbVrYezOx', 'k1w1SeihHyKDJXr7nZRX',
  ])

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json() as {
      voices: Array<{ voice_id: string; name: string; preview_url: string; category: string; labels: Record<string, string> }>
    }
    return data.voices
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
  } catch {
    return []
  }
}

export default async function VoicesPage() {
  const voices = await fetchVoices()
  return <VoicesClient initialVoices={voices} />
}
