import { getSessionUser } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return new Response('Non authentifié', { status: 401 })
  return Response.json(user)
}
