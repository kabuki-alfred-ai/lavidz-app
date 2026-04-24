import { prisma } from '@lavidz/database'
import { hashPassword } from '@/lib/auth'

export const runtime = 'nodejs'

function toSlug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function POST(req: Request) {
  const { orgName, orgSlug, email, password, firstName, lastName } = await req.json()
  if (!orgName || !email || !password) {
    return new Response('Nom organisation, email et mot de passe requis', { status: 400 })
  }
  if (password.length < 8) {
    return new Response('Le mot de passe doit contenir au moins 8 caractères', { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()
  const slug = orgSlug ? toSlug(orgSlug) : toSlug(orgName)

  const [existingUser, existingOrg] = await Promise.all([
    prisma.user.findUnique({ where: { email: normalizedEmail } }),
    prisma.organization.findUnique({ where: { slug } }),
  ])

  if (existingUser) return new Response('Un compte existe déjà avec cet email', { status: 409 })
  if (existingOrg) return new Response('Ce slug d\'organisation est déjà pris', { status: 409 })

  const passwordHash = await hashPassword(password)

  const org = await prisma.organization.create({
    data: { name: orgName, slug, status: 'ACTIVE' },
  })

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      role: 'ADMIN',
      organizationId: org.id,
    },
  })

  return Response.json({ ok: true })
}
