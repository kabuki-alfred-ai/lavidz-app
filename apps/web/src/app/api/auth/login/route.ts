import { prisma } from '@lavidz/database'
import { comparePassword, setSessionCookie } from '@/lib/auth'
import type { UserRole } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { email, password } = await req.json()
  if (!email || !password) return new Response('Email et mot de passe requis', { status: 400 })

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { organization: true },
  })

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return new Response('Email ou mot de passe incorrect', { status: 401 })
  }

  // ADMIN users require active org; SUPERADMIN bypasses
  if (user.role === 'ADMIN' && user.organization?.status !== 'ACTIVE') {
    return new Response("Votre organisation est en attente de validation par l'équipe Lavidz.", { status: 403 })
  }

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as UserRole,
    organizationId: user.organizationId ?? null,
  })

  return Response.json({ ok: true, role: user.role })
}
