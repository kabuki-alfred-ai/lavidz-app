export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const res = await fetch(`${API}/api/sessions/${id}/deliver`, {
      method: 'POST',
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
