import { prisma } from '@lavidz/database'
import { getSessionUser, type SessionPayload } from './auth'

export type FreshUserPayload = SessionPayload & {
  /**
   * Effective org to use for data scoping.
   * - SUPERADMIN with activeOrgId → activeOrgId
   * - Otherwise → user's own organizationId
   */
  effectiveOrgId: string | null
}

/**
 * Returns the session user enriched with fresh data from DB.
 * Needed when the JWT token is stale (e.g. organizationId assigned after login).
 * Also computes `effectiveOrgId` so SUPERADMIN org-switching works across all routes.
 */
export async function getFreshUser(): Promise<FreshUserPayload | null> {
  const session = await getSessionUser()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, organizationId: true, role: true },
  })

  if (!user) return null

  const effectiveOrgId =
    session.role === 'SUPERADMIN' && session.activeOrgId
      ? session.activeOrgId
      : user.organizationId

  return {
    ...session,
    organizationId: user.organizationId,
    effectiveOrgId,
  }
}
