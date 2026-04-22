import { notFound, redirect } from 'next/navigation'
import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type PageProps = {
  // [id] = sessionId historique — la publication a migré sur Project.
  params: Promise<{ id: string }>
}

/**
 * Task 11.3 — redirect legacy `/sujets/[sessionId]/publier` → `/projects/[id]/publier`.
 * Lookup du Project associé via `Project.sessionId` (unique, F5). 404 si aucun
 * Project (session trop ancienne / jamais auto-create). Backward-compat 1 sprint
 * puis suppression dure.
 */
export default async function LegacyPublishRedirect({ params }: PageProps) {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login')

  const { id: sessionId } = await params

  const project = await prisma.project.findFirst({
    where: { sessionId, organizationId: user.organizationId ?? undefined },
    select: { id: true },
  })
  if (!project) notFound()

  redirect(`/projects/${project.id}/publier`)
}
