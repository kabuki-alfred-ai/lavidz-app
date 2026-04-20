export const runtime = 'nodejs'
export const maxDuration = 60

import { getSessionUser } from '@/lib/auth'
import { apiUrl, getAuthHeaders, unauthorized, noOrg } from '@/lib/api-proxy'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const res = await fetch(apiUrl(`/ai/sources/${id}`), {
      headers: auth.headers,
      cache: 'no-store',
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[sources GET]', err)
    return new Response('Sources indisponibles', { status: 500 })
  }
}

export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const res = await fetch(apiUrl(`/ai/sources/${id}/fetch`), {
      method: 'POST',
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[sources POST]', err)
    return new Response('Recherche de sources indisponible', { status: 500 })
  }
}
