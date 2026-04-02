import { NextResponse } from 'next/server'
import { getSessionUser, setSessionCookie } from '@/lib/auth'
import { prisma } from '@lavidz/database'

export async function POST(request: Request) {
  const user = await getSessionUser()

  if (!user || user.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { orgId } = body as { orgId: string | null }

  if (orgId !== null) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
  }

  await setSessionCookie({ ...user, activeOrgId: orgId ?? null })

  return NextResponse.json({ success: true })
}
