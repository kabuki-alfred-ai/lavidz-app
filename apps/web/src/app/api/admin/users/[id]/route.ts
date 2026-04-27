export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== 'SUPERADMIN') {
      return new Response('Forbidden', { status: 403 })
    }

    const { id } = await params

    if (id === user.userId) {
      return new Response('Impossible de supprimer son propre compte.', { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    })

    if (!target) return new Response('Utilisateur introuvable.', { status: 404 })
    if (target.role === 'SUPERADMIN') {
      return new Response('Impossible de supprimer un SUPERADMIN.', { status: 403 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminInvitation.updateMany({ where: { invitedById: id }, data: { invitedById: null } })
      await tx.orgInvitation.updateMany({ where: { invitedById: id }, data: { invitedById: null } })
      await tx.entrepreneurProfile.deleteMany({ where: { userId: id } })
      await tx.user.delete({ where: { id } })
    })

    return new Response(null, { status: 204 })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
