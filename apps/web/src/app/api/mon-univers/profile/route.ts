export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const res = await fetch(apiUrl('/ai/profile'), { headers: auth.headers })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const body = await req.json().catch(() => ({}))
    const res = await fetch(apiUrl('/ai/profile'), {
      method: 'PUT',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
