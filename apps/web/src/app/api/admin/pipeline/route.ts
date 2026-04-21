export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized } from '@/lib/api-proxy'

export async function GET() {
  try {
    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()
    const res = await fetch(apiUrl('/pipeline'), { headers: auth.headers })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
