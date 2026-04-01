export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const res = await fetch(`${API}/api/users/org-invitations/verify/${token}`)
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
