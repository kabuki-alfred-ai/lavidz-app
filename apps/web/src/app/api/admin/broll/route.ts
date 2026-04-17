export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { getAuthHeaders, apiUrl, unauthorized } from '@/lib/api-proxy'

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const tags = req.nextUrl.searchParams.get('tags')
    const qs = tags ? `?tags=${encodeURIComponent(tags)}` : ''

    const res = await fetch(apiUrl(`/broll${qs}`), { headers: auth.headers })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const body = await req.json()
    const res = await fetch(apiUrl('/broll'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.headers },
      body: JSON.stringify(body),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
