import { VoicesClient } from './VoicesClient'

async function fetchVoices() {
  // Delegate to the internal API route — automatically includes ElevenLabs + MiniMax
  const baseUrl = process.env.API_URL
    ? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    : 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/tts/voices`, { cache: 'no-store' })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export default async function VoicesPage() {
  const voices = await fetchVoices()
  return <VoicesClient initialVoices={voices} />
}
