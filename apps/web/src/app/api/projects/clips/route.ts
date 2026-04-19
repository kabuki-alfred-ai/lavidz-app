export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized, noOrg } from '@/lib/api-proxy'
import { getSessionUser } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const { projectId, recordingId } = await req.json()
    const res = await fetch(apiUrl(`/projects/${projectId}/clips`), {
      method: 'POST',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const { projectId, clipId } = await req.json()
    const res = await fetch(apiUrl(`/projects/${projectId}/clips/${clipId}`), {
      method: 'DELETE',
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return new Response(null, { status: 204 })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const { projectId, clipIds } = await req.json()
    const res = await fetch(apiUrl(`/projects/${projectId}/clips/reorder`), {
      method: 'PATCH',
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clipIds }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
