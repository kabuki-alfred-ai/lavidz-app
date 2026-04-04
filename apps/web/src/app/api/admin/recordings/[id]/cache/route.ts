export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

// POST /api/admin/recordings/:id/cache?sessionId=...&type=tts|processed&voiceId=...&processingHash=...
// Body (preferred): JSON { sourceUrl: string, type, voiceId?, processingHash? }
//   → server fetches the video and forwards to NestJS — browser never holds video bytes
// Body (legacy): multipart/form-data with field "file"
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId') ?? ''
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      // Server-side fetch: browser sends a URL, server fetches and forwards — zero browser memory
      const { sourceUrl, type, voiceId, processingHash } = await req.json() as {
        sourceUrl: string
        type: 'tts' | 'processed'
        voiceId?: string
        processingHash?: string
      }

      const videoRes = await fetch(sourceUrl)
      if (!videoRes.ok) return new Response('Failed to fetch source video', { status: 502 })

      const form = new FormData()
      const blob = await videoRes.blob()
      form.append('file', blob, type === 'tts' ? 'audio.mp3' : 'video.mp4')
      form.append('type', type)
      if (voiceId) form.append('voiceId', voiceId)
      if (processingHash) form.append('processingHash', processingHash)

      const res = await fetch(`${API}/api/sessions/${sessionId}/recordings/${id}/cache`, {
        method: 'POST',
        headers: { 'x-admin-secret': ADMIN_SECRET },
        body: form,
      })
      if (!res.ok) return new Response(await res.text(), { status: res.status })
      return Response.json(await res.json())
    }

    // Legacy multipart path (kept for compatibility)
    const rawBody = await req.arrayBuffer()
    const res = await fetch(`${API}/api/sessions/${sessionId}/recordings/${id}/cache`, {
      method: 'POST',
      headers: {
        'x-admin-secret': ADMIN_SECRET,
        'content-type': contentType,
        'content-length': String(rawBody.byteLength),
      },
      body: rawBody,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
