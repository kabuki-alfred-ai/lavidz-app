export const runtime = 'nodejs'
export const maxDuration = 60

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

const VALID_MODES = new Set(['weekly-moment', 'resurrect-seed', 'forgotten-domain', 'industry-news'])

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ mode: string }> },
) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const { mode } = await params
    if (!VALID_MODES.has(mode)) return new Response('Mode inconnu', { status: 400 })

    const res = await fetch(apiUrl(`/ai/unstuck/${mode}`), {
      method: 'POST',
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[unstuck]', err)
    return new Response("Kabou n'a pas réussi cette fois", { status: 500 })
  }
}
