export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const body = await req.json().catch(() => ({}))
    if (!Array.isArray(body?.proposals) || body.proposals.length === 0) {
      return new Response('proposals est requis', { status: 400 })
    }

    const res = await fetch(apiUrl('/ai/editorial-plan/commit'), {
      method: 'POST',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      return new Response(text || 'Enregistrement impossible', { status: res.status })
    }
    return Response.json(await res.json())
  } catch (err) {
    console.error('[editorial-plan commit]', err)
    return new Response('Enregistrement impossible', { status: 500 })
  }
}
