import { redirect } from 'next/navigation'
import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { HomeBrief } from './HomeBrief'
import { HomeKabouEntry } from './HomeKabouEntry'

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

    const totalActiveSubjects = orgId
      ? await prisma.topic.count({
          where: { organizationId: orgId, status: { not: 'ARCHIVED' } },
        })
      : 0

    if (totalActiveSubjects === 0) {
      return (
        <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col px-4 py-8">
          <HomeKabouEntry />
        </div>
      )
    }
  }
  return <HomeBrief />
}
