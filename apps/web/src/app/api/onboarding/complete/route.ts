export const runtime = 'nodejs'
export const maxDuration = 45

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { unauthorized, noOrg } from '@/lib/api-proxy'

type Answers = {
  activity: string
  audience?: string
  differentiator?: string
}

/**
 * Saves the 3 onboarding answers into EntrepreneurProfile.businessContext.
 * Non-blocking : answers < 10 chars are stored verbatim, the LLM summary step
 * runs afterwards via the existing profile/summarize endpoint.
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const orgId = user.organizationId
    if (!orgId) return noOrg()

    const body = (await req.json()) as Answers
    if (!body.activity?.trim() || body.activity.trim().length < 10) {
      return new Response('Dis-moi au moins une phrase sur ce que tu fais.', { status: 400 })
    }

    const existing = await prisma.entrepreneurProfile.findUnique({
      where: { organizationId: orgId },
      select: { businessContext: true },
    })
    const current = (existing?.businessContext ?? {}) as Record<string, unknown>

    const next = {
      ...current,
      onboarding: {
        activity: body.activity.trim(),
        audience: body.audience?.trim() ?? null,
        differentiator: body.differentiator?.trim() ?? null,
        completedAt: new Date().toISOString(),
      },
      // Seed a soft conversationSummary so profileService.generateAndSaveSummary
      // has material to work with next time the user opens chat.
      conversationSummary:
        typeof current.conversationSummary === 'string' && current.conversationSummary.length > 100
          ? current.conversationSummary
          : [
              `Activité : ${body.activity.trim()}`,
              body.audience ? `Audience : ${body.audience.trim()}` : '',
              body.differentiator ? `Ce qui me distingue : ${body.differentiator.trim()}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
    }

    await prisma.entrepreneurProfile.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        ownerType: 'ORGANIZATION',
        businessContext: next,
      },
      update: {
        businessContext: next,
      },
    })

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[onboarding/complete]', err)
    return new Response('Sauvegarde impossible', { status: 500 })
  }
}
