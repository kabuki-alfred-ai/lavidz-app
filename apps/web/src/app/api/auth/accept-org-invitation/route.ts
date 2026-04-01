export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'

export async function POST(req: Request) {
  try {
    const { token, password, firstName, lastName } = await req.json()
    if (!token || !password) return new Response('Token et mot de passe requis', { status: 400 })

    const res = await fetch(`${API}/api/users/org-invitations/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, firstName, lastName }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
