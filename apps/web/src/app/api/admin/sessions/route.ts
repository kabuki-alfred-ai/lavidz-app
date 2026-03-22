export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function POST(req: Request) {
  try {
    const { themeId, recipientEmail, recipientName } = await req.json()

    const res = await fetch(`${API}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
      body: JSON.stringify({ themeId, recipientEmail, recipientName }),
    })

    if (!res.ok) return new Response(await res.text(), { status: res.status })

    const session = await res.json()
    const baseUrl = req.headers.get('origin') ?? 'http://localhost:3000'
    const shareUrl = `${baseUrl}/s/${session.id}`

    return Response.json({ sessionId: session.id, shareUrl })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
