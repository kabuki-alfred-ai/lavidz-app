export const runtime = 'nodejs'
export const maxDuration = 30

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const body = await req.json()
    const insight = typeof body?.insight === 'string' ? body.insight : ''
    if (insight.trim().length < 30) {
      return new Response('insight trop court (min 30 caractères)', { status: 400 })
    }

    const res = await fetch(apiUrl('/ai/topics/from-insight'), {
      method: 'POST',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        insight,
        sourceThreadId: body?.sourceThreadId ?? null,
      }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[topics/from-insight]', err)
    return new Response('Création impossible pour le moment', { status: 500 })
  }
}
