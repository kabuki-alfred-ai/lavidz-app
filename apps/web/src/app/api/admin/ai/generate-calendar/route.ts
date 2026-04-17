export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized } from '@/lib/api-proxy'

export async function POST(req: Request) {
  try {
    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()

    const body = await req.json()
    const res = await fetch(apiUrl('/ai/generate-calendar'), {
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
