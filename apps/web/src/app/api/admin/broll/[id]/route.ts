export const runtime = 'nodejs'

import { getFreshUser } from '@/lib/get-fresh-user'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getFreshUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { id } = await params
    const res = await fetch(`${API}/api/broll/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return new Response(null, { status: 204 })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
