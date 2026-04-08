import { isMiniMax } from '@/lib/tts-provider'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // MiniMax voices are local only — no remote account to delete from
  if (isMiniMax(id)) return new Response(null, { status: 204 })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return new Response('Missing API key', { status: 500 })

  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${id}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(`ElevenLabs error: ${err}`, { status: res.status })
  }

  return new Response(null, { status: 204 })
}
