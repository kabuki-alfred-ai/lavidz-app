import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'

export const runtime = 'nodejs'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== 'SUPERADMIN') return new Response('Forbidden', { status: 403 })

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, themes: true } },
    },
  })

  return Response.json(orgs)
}

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user || user.role !== 'SUPERADMIN') return new Response('Forbidden', { status: 403 })

  const { name } = await req.json()
  if (!name?.trim()) return new Response('Nom requis', { status: 400 })

  const trimmed = name.trim()
  const baseSlug = slugify(trimmed)

  const existing = await prisma.organization.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  })
  if (existing) return new Response('Une organisation avec ce nom existe déjà', { status: 409 })

  const slugTaken = await prisma.organization.findUnique({ where: { slug: baseSlug } })
  const finalSlug = slugTaken ? `${baseSlug}-${Math.random().toString(36).slice(2, 8)}` : baseSlug

  const org = await prisma.organization.create({
    data: { name: trimmed, slug: finalSlug, status: 'ACTIVE' },
    include: { _count: { select: { users: true, themes: true } } },
  })

  return Response.json(org, { status: 201 })
}
