import { isMiniMax, generateMiniMaxTTS } from '@/lib/tts-provider'

const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL' // Sarah — multilingual fallback

export async function POST(req: Request) {
  const { text, voiceId } = await req.json()

  // ─── MiniMax branch ───────────────────────────────────────────────────────
  if (isMiniMax(voiceId)) {
    const audio = await generateMiniMaxTTS(text, voiceId)
    if (!audio) return new Response('MiniMax TTS failed', { status: 502 })
    return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg' } })
  }

  // ─── ElevenLabs branch ────────────────────────────────────────────────────
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return new Response('Missing ElevenLabs API key', { status: 500 })

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId ?? DEFAULT_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
    }),
  })

  // Plan doesn't support this voice (library voices require Creator plan) — retry with default
  if (res.status === 402 && voiceId && voiceId !== DEFAULT_VOICE_ID) {
    const fallback = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
      }),
    })
    if (fallback.ok) {
      const audio = await fallback.arrayBuffer()
      return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'X-Voice-Fallback': 'true' } })
    }
  }

  if (!res.ok) {
    const err = await res.text()
    return new Response(`ElevenLabs error: ${err}`, { status: res.status })
  }

  const audio = await res.arrayBuffer()
  return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg' } })
}
