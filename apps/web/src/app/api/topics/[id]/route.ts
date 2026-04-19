export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized, noOrg } from '@/lib/api-proxy'
import { getSessionUser } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()
    const { id } = await params

    const res = await fetch(apiUrl(`/ai/topics/${id}`), { headers: auth.headers })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()
    const { id } = await params

    const body = await req.json()
    const res = await fetch(apiUrl(`/ai/topics/${id}`), {
      method: 'PUT',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()
    const { id } = await params

    const res = await fetch(apiUrl(`/ai/topics/${id}`), {
      method: 'DELETE',
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
