export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized } from '@/lib/api-proxy'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()
    const { id } = await params
    const body = await req.json()
    const res = await fetch(apiUrl(`/ai/topics/${id}/status`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth.headers },
      body: JSON.stringify(body),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
