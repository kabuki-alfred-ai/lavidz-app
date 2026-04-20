export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const url = new URL(req.url)
    const limit = url.searchParams.get('limit') ?? '50'

    const res = await fetch(apiUrl(`/ai/memories?limit=${limit}`), {
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
