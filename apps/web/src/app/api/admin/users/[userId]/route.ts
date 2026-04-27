export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== 'SUPERADMIN') {
      return new Response('Forbidden', { status: 403 })
    }

    const { userId } = await params

    if (userId === user.userId) {
      return new Response('Impossible de supprimer son propre compte.', { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    })

    if (!target) return new Response('Utilisateur introuvable.', { status: 404 })
    if (target.role === 'SUPERADMIN') {
      return new Response('Impossible de supprimer un SUPERADMIN.', { status: 403 })
    }

    await prisma.$transaction(async (tx) => {
      // Nullify FK references before deletion
      await tx.adminInvitation.updateMany({ where: { invitedById: userId }, data: { invitedById: null } })
      await tx.orgInvitation.updateMany({ where: { invitedById: userId }, data: { invitedById: null } })
      // Delete user-owned profile (cascades ConversationMemory)
      await tx.entrepreneurProfile.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    })

    return new Response(null, { status: 204 })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
