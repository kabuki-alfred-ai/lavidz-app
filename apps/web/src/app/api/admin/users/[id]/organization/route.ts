import { getSessionUser } from '@/lib/auth'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

const API = process.env.API_URL ?? 'http://localhost:3001'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user || user.role !== 'SUPERADMIN') return new Response('Forbidden', { status: 403 })

  const { id } = await params
  const body = await req.json() as { organizationId: string | null }

  const res = await fetch(`${API}/api/users/${id}/organization`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': process.env.ADMIN_SECRET ?? '',
    },
    body: JSON.stringify({ organizationId: body.organizationId }),
  })

  if (!res.ok) return new Response(await res.text(), { status: res.status })
  return Response.json(await res.json())
}
