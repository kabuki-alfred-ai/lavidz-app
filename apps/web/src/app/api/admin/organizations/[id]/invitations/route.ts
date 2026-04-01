export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const res = await fetch(`${API}/api/users/org-invitations/by-org/${id}`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { email, role, invitedById } = await req.json()
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'

    const res = await fetch(`${API}/api/users/org-invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET,
        'x-forwarded-origin': origin,
      },
      body: JSON.stringify({ email, organizationId: id, role, invitedById }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json(), { status: 201 })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
