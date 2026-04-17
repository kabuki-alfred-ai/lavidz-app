export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const formData = await req.formData()
    const audio = formData.get('audio')
    if (!audio || !(audio instanceof Blob)) {
      return new Response('Missing audio', { status: 400 })
    }

    // Use Groq Whisper if available, else OpenAI
    const groqKey = process.env.GROQ_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    if (!groqKey && !openaiKey) {
      return new Response('No transcription API key configured', { status: 500 })
    }

    const useGroq = !!groqKey
    const apiUrl = useGroq
      ? 'https://api.groq.com/openai/v1/audio/transcriptions'
      : 'https://api.openai.com/v1/audio/transcriptions'
    const apiKey = useGroq ? groqKey! : openaiKey!
    const model = useGroq ? 'whisper-large-v3' : 'whisper-1'

    const whisperForm = new FormData()
    whisperForm.append('file', audio, 'audio.webm')
    whisperForm.append('model', model)
    whisperForm.append('language', 'fr')
    whisperForm.append('response_format', 'json')

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Whisper error:', errText)
      return new Response('Transcription failed', { status: 500 })
    }

    const data = await res.json()
    return Response.json({ text: data.text ?? '' })
  } catch (err: any) {
    console.error('Transcribe error:', err)
    return new Response(err.message ?? 'Internal error', { status: 500 })
  }
}
