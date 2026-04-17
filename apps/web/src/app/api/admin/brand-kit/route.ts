export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized } from '@/lib/api-proxy'

export async function GET() {
  try {
    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const res = await fetch(apiUrl('/brand-kit'), { headers: auth.headers })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
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
