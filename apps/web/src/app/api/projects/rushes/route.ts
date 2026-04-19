export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized, noOrg } from '@/lib/api-proxy'
import { getSessionUser } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const { searchParams } = new URL(req.url)
    const params = new URLSearchParams({ organizationId: auth.orgId })
    const format = searchParams.get('format')
    const themeId = searchParams.get('themeId')
    const search = searchParams.get('search')
    if (format) params.set('format', format)
    if (themeId) params.set('themeId', themeId)
    if (search) params.set('search', search)

    const res = await fetch(apiUrl(`/projects/rushes/library?${params}`), { headers: auth.headers })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
