export const runtime = 'nodejs'

import { getFreshUser } from '@/lib/get-fresh-user'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function POST() {
  try {
    const user = await getFreshUser()
    if (!user || user.role !== 'SUPERADMIN') {
      return new Response('Unauthorized', { status: 401 })
    }
    if (!user.organizationId) {
      return new Response('SUPERADMIN sans organisation assignée.', { status: 400 })
    }

    const res = await fetch(`${API}/api/ai/profile/summarize`, {
      method: 'POST',
      headers: { 'x-admin-secret': ADMIN_SECRET, 'x-organization-id': user.organizationId },
    })

    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
