export const runtime = 'nodejs'

import { getFreshUser } from '@/lib/get-fresh-user'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function GET() {
  try {
    const user = await getFreshUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    if (!user.effectiveOrgId) return new Response('Aucune organisation assignée.', { status: 400 })

    const res = await fetch(`${API}/api/users/org-invitations/by-org/${user.effectiveOrgId}`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getFreshUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return new Response('Forbidden', { status: 403 })
    }
    if (!user.effectiveOrgId) return new Response('Aucune organisation assignée.', { status: 400 })

    const { email, role } = await req.json()
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'

    const res = await fetch(`${API}/api/users/org-invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': ADMIN_SECRET,
        'x-forwarded-origin': origin,
      },
      body: JSON.stringify({ email, organizationId: user.effectiveOrgId, role, invitedById: user.userId }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json(), { status: 201 })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
