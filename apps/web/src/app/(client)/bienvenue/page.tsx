import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@lavidz/database'
import { OnboardingView } from './OnboardingView'

export const dynamic = 'force-dynamic'

/**
 * Onboarding — new users land here the very first time so Kabou can build
 * the seed of a profile without throwing them into a 9-item nav. Returning
 * users with an existing businessContext.onboarding are redirected home.
 */
export default async function WelcomePage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')
  const orgId = user.organizationId
  if (!orgId) redirect('/home')

  const profile = await prisma.entrepreneurProfile.findUnique({
    where: { organizationId: orgId },
    select: { businessContext: true },
  })
  const ctx = (profile?.businessContext ?? {}) as Record<string, unknown>
  if (ctx.onboarding) {
    // Already onboarded — go straight to the hub.
    redirect('/home')
  }

  return <OnboardingView firstName={user.firstName ?? null} />
}
