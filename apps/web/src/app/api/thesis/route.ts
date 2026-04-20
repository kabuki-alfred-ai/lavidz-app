export const runtime = 'nodejs'
export const maxDuration = 45

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const res = await fetch(apiUrl('/ai/thesis'), { headers: auth.headers, cache: 'no-store' })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[thesis GET]', err)
    return new Response('Thèse indisponible', { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const body = await req.json()
    const res = await fetch(apiUrl('/ai/thesis'), {
      method: 'PUT',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[thesis PUT]', err)
    return new Response('Sauvegarde impossible', { status: 500 })
  }
}

export async function DELETE() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const res = await fetch(apiUrl('/ai/thesis'), {
      method: 'DELETE',
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[thesis DELETE]', err)
    return new Response('Suppression impossible', { status: 500 })
  }
}
