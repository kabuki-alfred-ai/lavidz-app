export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
