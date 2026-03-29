export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('sessionId') ?? '_'
    const res = await fetch(`${API}/api/sessions/${sessionId}/recordings/${id}/tts-url`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    const signedUrl = await res.text()
    return Response.json(signedUrl)
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
