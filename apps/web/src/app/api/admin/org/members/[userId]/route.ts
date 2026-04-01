export const runtime = 'nodejs'

import { getFreshUser } from '@/lib/get-fresh-user'
import { prisma } from '@lavidz/database'

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const user = await getFreshUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return new Response('Forbidden', { status: 403 })
    }
    if (!user.organizationId) return new Response('Aucune organisation assignée.', { status: 400 })

    const { userId } = await params

    if (userId === user.userId) {
      return new Response('Impossible de se retirer soi-même.', { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    })

    if (!target || target.organizationId !== user.organizationId) {
      return new Response('Utilisateur introuvable dans cette organisation.', { status: 404 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { organizationId: null, role: 'USER' },
    })

    return new Response(null, { status: 204 })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
