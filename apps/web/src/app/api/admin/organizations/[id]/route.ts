import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'

export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || user.role !== 'SUPERADMIN') return new Response('Forbidden', { status: 403 })

  const { id } = await params
  const { status } = await req.json()

  if (!['PENDING', 'ACTIVE', 'SUSPENDED'].includes(status)) {
    return new Response('Statut invalide', { status: 400 })
  }

  const org = await prisma.organization.update({
    where: { id },
    data: { status },
  })

  return Response.json(org)
}
