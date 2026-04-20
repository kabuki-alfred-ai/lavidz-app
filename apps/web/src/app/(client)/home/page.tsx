import { redirect } from 'next/navigation'
import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { HomeBrief } from './HomeBrief'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')
  const orgId = user.organizationId
  if (orgId) {
    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId: orgId },
      select: { businessContext: true },
    })
    const ctx = (profile?.businessContext ?? {}) as Record<string, unknown>
    if (!ctx.onboarding) {
      redirect('/bienvenue')
    }
  }
  return <HomeBrief />
}
