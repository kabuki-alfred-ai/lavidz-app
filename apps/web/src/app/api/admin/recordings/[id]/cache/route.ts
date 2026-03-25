export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

// POST /api/admin/recordings/:id/cache?sessionId=...&type=tts|processed&voiceId=...&processingHash=...
// Body: multipart/form-data with field "file"
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId') ?? ''

    // Forward the multipart form data as-is to NestJS
    const formData = await req.formData()
    // Append params as form fields so NestJS body can read them
    if (!formData.has('type')) {
      const type = url.searchParams.get('type')
      if (type) formData.append('type', type)
    }
    if (!formData.has('voiceId')) {
      const voiceId = url.searchParams.get('voiceId')
      if (voiceId) formData.append('voiceId', voiceId)
    }
    if (!formData.has('processingHash')) {
      const processingHash = url.searchParams.get('processingHash')
      if (processingHash) formData.append('processingHash', processingHash)
    }

    const res = await fetch(`${API}/api/sessions/${sessionId}/recordings/${id}/cache`, {
      method: 'POST',
      headers: { 'x-admin-secret': ADMIN_SECRET },
      body: formData,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
