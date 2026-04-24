export const runtime = 'nodejs'

import { getAuthHeaders, apiUrl, unauthorized } from '@/lib/api-proxy'
import { recordSubjectEvent } from '@/lib/subject-events'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthHeaders()
    if (!auth) return unauthorized()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const res = await fetch(apiUrl(`/ai/topics/${id}/record-now`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.headers },
      body: JSON.stringify(body),
    })
    if (!res.ok) return new Response(await res.text(), { status: res.status })
    const payload = (await res.json()) as {
      sessionId?: string
      format?: string
    }
    await recordSubjectEvent({
      topicId: id,
      type: 'session_created',
      actor: 'user',
      metadata: {
        sessionId: payload.sessionId ?? null,
        contentFormat: payload.format ?? (body as { format?: string }).format ?? null,
      },
    })
    return Response.json(payload)
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
