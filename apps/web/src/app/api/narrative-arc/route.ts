export const runtime = 'nodejs'
export const maxDuration = 60

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const res = await fetch(apiUrl('/ai/narrative-arc'), {
      headers: auth.headers,
      cache: 'no-store',
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[narrative-arc]', err)
    return new Response('Arche narrative indisponible', { status: 500 })
  }
}
