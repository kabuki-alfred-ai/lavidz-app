export const runtime = 'nodejs'

import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const effectiveOrgId =
      user.role === 'SUPERADMIN' && user.activeOrgId
        ? user.activeOrgId
        : user.organizationId ?? null

    const { name, slug, description, introduction } = await req.json()

    if (!name || !slug) {
      return new Response('name et slug sont requis', { status: 400 })
    }

    const theme = await prisma.theme.create({
      data: {
        name,
        slug,
        description: description || null,
        introduction: introduction || null,
        organizationId: effectiveOrgId,
      },
    })

    return Response.json(theme, { status: 201 })
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return new Response('Ce slug est déjà utilisé.', { status: 409 })
    }
    return new Response(String(err), { status: 500 })
  }
}
