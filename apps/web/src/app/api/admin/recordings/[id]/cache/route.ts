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

    // Buffer the multipart body then forward to NestJS.
    // The client sends type/voiceId/processingHash as FormData fields alongside the file.
    const contentType = req.headers.get('content-type') ?? ''
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
