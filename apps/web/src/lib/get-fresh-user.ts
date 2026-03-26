import { prisma } from '@lavidz/database'
import { getSessionUser, type SessionPayload } from './auth'

/**
 * Returns the session user enriched with fresh data from DB.
 * Needed when the JWT token is stale (e.g. organizationId assigned after login).
 */
export async function getFreshUser(): Promise<SessionPayload | null> {
  const session = await getSessionUser()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, organizationId: true, role: true },
  })

  if (!user) return null

  return {
    ...session,
    organizationId: user.organizationId,
  }
}
