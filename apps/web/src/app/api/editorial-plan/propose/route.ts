export const runtime = 'nodejs'
export const maxDuration = 60

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const body = await req.json().catch(() => ({}))

    const res = await fetch(apiUrl('/ai/editorial-plan/propose'), {
      method: 'POST',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      return new Response(text || 'Kabou n\'a pas réussi cette fois', { status: res.status })
    }
    return Response.json(await res.json())
  } catch (err) {
    console.error('[editorial-plan propose]', err)
    return new Response('Kabou n\'a pas réussi cette fois', { status: 500 })
  }
}
