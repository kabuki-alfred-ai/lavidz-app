import { NextResponse } from 'next/server'
import { prisma } from '@lavidz/database'
import { getSessionUser, hashPassword, comparePassword, setSessionCookie } from '@/lib/auth'

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const body = await req.json()
    const { email, firstName, lastName, currentPassword, newPassword } = body

    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } })
    if (!dbUser) return new NextResponse('User not found', { status: 404 })

    const updates: any = {}

    if (firstName !== undefined) updates.firstName = firstName
    if (lastName !== undefined) updates.lastName = lastName

    // Update email
    if (email && email !== dbUser.email) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing && existing.id !== dbUser.id) {
        return new NextResponse('Cet email est déjà utilisé', { status: 400 })
      }
      updates.email = email
    }

    // Update password
    if (currentPassword && newPassword) {
      if (!dbUser.passwordHash) {
        return new NextResponse('Mot de passe non défini pour cet utilisateur', { status: 400 })
      }
      const isMatch = await comparePassword(currentPassword, dbUser.passwordHash)
      if (!isMatch) {
        return new NextResponse('Mot de passe actuel incorrect', { status: 400 })
      }
      updates.passwordHash = await hashPassword(newPassword)
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: user.userId },
        data: updates,
      })

      // Refresh cookie with all latest info
      await setSessionCookie({ 
        ...user, 
        email: updates.email || user.email,
        firstName: firstName !== undefined ? firstName : user.firstName,
        lastName: lastName !== undefined ? lastName : user.lastName
      })
    }

    return NextResponse.json({ success: true, message: 'Profil mis à jour' })
  } catch (error: any) {
    console.error('[PROFILE_UPDATE]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
