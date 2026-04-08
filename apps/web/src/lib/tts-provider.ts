export const MINIMAX_PREFIX = 'mm:'

export function isMiniMax(voiceId: string): boolean {
  return voiceId.startsWith(MINIMAX_PREFIX)
}

export function stripMiniMaxPrefix(voiceId: string): string {
  return voiceId.replace(/^mm:/, '')
}

/**
 * Generate TTS audio via MiniMax T2A v2 API.
 * Returns a Buffer (MP3) or null on any failure.
 */
export async function generateMiniMaxTTS(text: string, voiceId: string): Promise<Buffer | null> {
  const apiKey = process.env.MINIMAX_API_KEY

  if (!apiKey) return null

  const rawVoiceId = stripMiniMaxPrefix(voiceId)

  try {
    const res = await fetch(`https://api.minimax.io/v1/t2a_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'speech-02-turbo',
        text,
        stream: false,
        voice_setting: { voice_id: rawVoiceId, speed: 1.0, vol: 1.0, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
      }),
    })

    if (!res.ok) {
      console.error('[MiniMax TTS] API error', res.status, await res.text())
      return null
    }

    const data = await res.json() as { data?: { audio?: string }; base_resp?: { status_code: number; status_msg: string } }

    if (data.base_resp && data.base_resp.status_code !== 0) {
      console.error('[MiniMax TTS] API error', data.base_resp)
      return null
    }

    const hex = data.data?.audio
    if (!hex) return null

    return Buffer.from(hex, 'hex')
  } catch (err) {
    console.error('[MiniMax TTS] fetch error', err)
    return null
  }
}

/**
 * Fetch the MiniMax voice list.
 * Returns an array of normalized voice objects or [] on failure.
 */
export async function fetchMiniMaxVoices(): Promise<Array<{
  id: string
  name: string
  previewUrl: string
  category: string
  accent: string
  gender: string
  language: string
}>> {
  const apiKey = process.env.MINIMAX_API_KEY

  if (!apiKey) return []

  try {
    const res = await fetch(`https://api.minimax.io/v1/get_voice`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice_type: 'all' }),
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error('[MiniMax voices] API error', res.status)
      return []
    }

    const data = await res.json() as {
      system_voice?: Array<{ voice_id: string; voice_name: string }>
      voice_cloning?: Array<{ voice_id: string; description?: string }>
      voice_generation?: Array<{ voice_id: string; description?: string }>
      base_resp?: { status_code: number; status_msg: string }
    }

    if (data.base_resp && data.base_resp.status_code !== 0) {
      console.error('[MiniMax voices] API error', data.base_resp)
      return []
    }

    const systemVoices = (data.system_voice ?? []).map(v => ({
      id: `${MINIMAX_PREFIX}${v.voice_id}`,
      name: v.voice_name,
      previewUrl: '',
      category: 'minimax',
      accent: '',
      gender: '',
      language: '',
    }))
    const clonedVoices = [...(data.voice_cloning ?? []), ...(data.voice_generation ?? [])].map(v => ({
      id: `${MINIMAX_PREFIX}${v.voice_id}`,
      name: v.description ?? v.voice_id,
      previewUrl: '',
      category: 'minimax',
      accent: '',
      gender: '',
      language: '',
    }))

    return [...systemVoices, ...clonedVoices]
  } catch (err) {
    console.error('[MiniMax voices] fetch error', err)
    return []
  }
}
