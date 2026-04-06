export const runtime = 'nodejs'

import { getFreshUser } from '@/lib/get-fresh-user'

const API = process.env.API_URL ?? 'http://localhost:3001'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function GET(req: Request) {
  try {
    const user = await getFreshUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }
    if (!user.effectiveOrgId) {
      return new Response('Aucune organisation assignée.', { status: 400 })
    }

    const url = new URL(req.url)
    const limit = url.searchParams.get('limit') ?? '20'

    const res = await fetch(`${API}/api/ai/memories?limit=${limit}`, {
      headers: { 'x-admin-secret': ADMIN_SECRET, 'x-organization-id': user.effectiveOrgId },
    })

    if (!res.ok) return new Response(await res.text(), { status: res.status })
    return Response.json(await res.json())
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
