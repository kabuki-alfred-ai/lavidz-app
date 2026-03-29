export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

// POST /api/admin/recordings/:id/cache?sessionId=...&type=tts|processed&voiceId=...&processingHash=...
// Body: multipart/form-data with fields "file", "type", "voiceId", "processingHash"
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId') ?? ''

    // Stream the multipart body directly to NestJS to avoid buffering large video files.
    // The client already sends type/voiceId/processingHash as FormData fields.
    const res = await fetch(`${API}/api/sessions/${sessionId}/recordings/${id}/cache`, {
      method: 'POST',
      headers: {
        'x-admin-secret': ADMIN_SECRET,
        'content-type': req.headers.get('content-type') ?? '',
      },
      // @ts-expect-error duplex is required for streaming request bodies in Node.js
      body: req.body,
      duplex: 'half',
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
