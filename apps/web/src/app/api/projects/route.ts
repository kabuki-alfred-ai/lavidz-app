export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized, noOrg } from '@/lib/api-proxy'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const res = await fetch(apiUrl(`/projects?organizationId=${auth.orgId}`), { headers: auth.headers })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const body = await req.json()
    const res = await fetch(apiUrl('/projects'), {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, organizationId: auth.orgId }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const { id, ...body } = await req.json()
    const res = await fetch(apiUrl(`/projects/${id}`), {
      method: 'PATCH',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const { id } = await req.json()
    const res = await fetch(apiUrl(`/projects/${id}`), {
      method: 'DELETE',
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return new Response(null, { status: 204 })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
