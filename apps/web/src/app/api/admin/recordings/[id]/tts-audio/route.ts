export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

// Proxies TTS audio bytes through our server so the Remotion player
// can load them without S3 CORS restrictions.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId') ?? '_'

    const urlRes = await fetch(`${API}/api/sessions/${sessionId}/recordings/${id}/tts-url`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })
    if (!urlRes.ok) return new Response('Not found', { status: 404 })
    const signedUrl = await urlRes.text()
    if (!signedUrl) return new Response('Not found', { status: 404 })

    const audioRes = await fetch(signedUrl)
    if (!audioRes.ok) return new Response('Audio unavailable', { status: 404 })

    const audio = await audioRes.arrayBuffer()
    return new Response(audio, {
      headers: {
        'Content-Type': audioRes.headers.get('content-type') ?? 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
