export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function GET() {
  try {
    const [adminsRes, invitationsRes] = await Promise.all([
      fetch(`${API}/api/users/superadmins`, { headers: { 'x-admin-secret': ADMIN_SECRET } }),
      fetch(`${API}/api/users/invitations`, { headers: { 'x-admin-secret': ADMIN_SECRET } }),
    ])
    const [admins, invitations] = await Promise.all([adminsRes.json(), invitationsRes.json()])
    return Response.json({ admins, invitations })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { email, invitedById } = await req.json()
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'
    const res = await fetch(`${API}/api/users/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET,
        'x-forwarded-origin': origin,
      },
      body: JSON.stringify({ email, invitedById }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
