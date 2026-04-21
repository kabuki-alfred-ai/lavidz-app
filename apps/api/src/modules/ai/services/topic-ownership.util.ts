import { NotFoundException } from '@nestjs/common'
import { prisma } from '@lavidz/database'
import type { Topic } from '@prisma/client'

/**
 * Enforce that a Topic belongs to the caller's organization.
 *
 * Returns 404 NotFoundException on mismatch (not 403) to avoid ID enumeration.
 * Call this at the start of EVERY endpoint that accepts a :id param for a Topic.
 *
 * AdminGuard alone is a shared-secret check — it does NOT scope to a tenant.
 * The x-organization-id header is client-settable, so we MUST re-verify DB-side.
 */
export async function assertTopicInOrg(topicId: string, organizationId: string): Promise<Topic> {
  if (!topicId || !organizationId) {
    throw new NotFoundException('Topic not found')
  }

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, organizationId },
  })

  if (!topic) {
    throw new NotFoundException('Topic not found')
  }

  return topic
}
