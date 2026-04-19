export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized } from '@/lib/api-proxy'

export async function GET() {
  try {
    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()
    if (!auth.orgId) return new Response('Aucune organisation associée à ce compte', { status: 400 })

    const res = await fetch(apiUrl('/brand-kit'), { headers: auth.headers })
    if (!res.ok) {
      const body = await res.text()
      console.error('[brand-kit GET] backend error', res.status, body)
      return new Response(body, { status: res.status })
    }
    const text = await res.text()
    if (!text || text === 'null') return Response.json(null)
    try {
      return Response.json(JSON.parse(text))
    } catch (parseErr) {
      console.error('[brand-kit GET] JSON parse failed:', parseErr, 'body=', text.slice(0, 200))
      return new Response('Réponse backend invalide', { status: 502 })
    }
  } catch (err) {
    console.error('[brand-kit GET] unexpected error:', err)
    return new Response(String(err), { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const body = await req.json()
    const res = await fetch(apiUrl('/brand-kit'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...auth.headers },
      body: JSON.stringify(body),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
