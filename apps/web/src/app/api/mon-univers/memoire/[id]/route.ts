export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const { id } = await params

    const res = await fetch(apiUrl(`/ai/memories/${id}`), {
      method: 'DELETE',
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
