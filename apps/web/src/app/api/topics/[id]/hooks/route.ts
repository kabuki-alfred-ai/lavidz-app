export const runtime = 'nodejs'
export const maxDuration = 30

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

    const res = await fetch(apiUrl(`/ai/subject-hooks/${id}`), {
      headers: auth.headers,
      cache: 'no-store',
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[subject-hooks GET]', err)
    return new Response('Accroches indisponibles', { status: 500 })
  }
}

export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const res = await fetch(apiUrl(`/ai/subject-hooks/${id}/generate`), {
      method: 'POST',
      headers: auth.headers,
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[subject-hooks POST]', err)
    return new Response('Génération indisponible pour le moment', { status: 500 })
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const auth = await getAuthHeaders()
    if (!auth?.orgId) return noOrg()

    const body = await req.json()
    const chosen = body?.chosen
    if (chosen !== null && chosen !== 'native' && chosen !== 'marketing') {
      return new Response("chosen doit être 'native', 'marketing' ou null", { status: 400 })
    }

    const res = await fetch(apiUrl(`/ai/subject-hooks/${id}/chosen`), {
      method: 'POST',
      headers: { ...auth.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ chosen }),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    console.error('[subject-hooks PATCH]', err)
    return new Response('Sauvegarde impossible', { status: 500 })
  }
}
