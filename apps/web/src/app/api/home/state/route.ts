export const runtime = 'nodejs'

import { prisma } from '@lavidz/database'
import { getSessionUser } from '@/lib/auth'
import { unauthorized, noOrg } from '@/lib/api-proxy'
import { deriveCreativeState, type CreativeState } from '@/lib/creative-state'

type ThesisShape = {
  statement?: string
  enemies?: string[]
  audienceArchetype?: string
  confidence?: 'forming' | 'emerging' | 'crystallized'
  updatedAt?: string
}

type NextStep =
  | { kind: 'publish'; label: string; href: string; sessionId: string; topicName: string }
  | { kind: 'record'; label: string; href: string; sessionId: string; topicName: string }
  | { kind: 'prepare_recording'; label: string; href: string; topicId: string; topicName: string }
  | { kind: 'continue_exploring'; label: string; href: string; topicId: string; topicName: string }
  | { kind: 'seed_exploration'; label: string; href: string; topicId: string; topicName: string }
  | { kind: 'first_subject'; label: string; href: string }

/**
 * GET /api/home/state — single source of truth for the Home hub.
 * Returns what the entrepreneur should focus on RIGHT NOW, plus the
 * counts to frame their current reality across creative states.
 */
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return unauthorized()
    const orgId = user.organizationId
    if (!orgId) return noOrg()

    const [topics, profile, recentSessions] = await Promise.all([
      prisma.topic.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          name: true,
          status: true,
          brief: true,
          updatedAt: true,
          calendarEntries: { select: { id: true }, take: 1 },
          sessions: {
            select: { id: true, status: true, submittedAt: true, updatedAt: true, publishedAt: true },
            orderBy: { updatedAt: 'desc' },
          },
        },
      }),
      prisma.entrepreneurProfile.findUnique({
        where: { organizationId: orgId },
        select: {
          businessContext: true,
          editorialPillars: true,
          thesis: true,
        },
      }),
      prisma.session.findMany({
        where: { theme: { organizationId: orgId } },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { submittedAt: true, status: true, updatedAt: true },
      }),
    ])

    // Derive creative state per topic (cheap client-compatible logic).
    const enriched = topics.map((t) => ({
      ...t,
      creativeState: deriveCreativeState({
        topicStatus: t.status,
        brief: t.brief ?? null,
      }),
    }))

    const counts: Record<CreativeState, number> = {
      SEED: 0,
      EXPLORING: 0,
      MATURE: 0,
      ARCHIVED: 0,
    }
    for (const t of enriched) counts[t.creativeState]++

    const totalActiveSubjects = counts.SEED + counts.EXPLORING + counts.MATURE
    const publishedTotal = enriched.reduce(
      (sum, t) => sum + t.sessions.filter((s) => s.publishedAt || s.status === 'DONE').length,
      0,
    )

    // --- Next-step resolution, in priority order ------------------------

    // (1) Unpublished DONE session → publish
    const publishableSession = enriched
      .flatMap((t) => t.sessions.map((s) => ({ topic: t, session: s })))
      .find(({ session }) => session.status === 'DONE' && !session.publishedAt)
    if (publishableSession) {
      const step: NextStep = {
        kind: 'publish',
        label: 'Publier ce contenu',
        href: `/sujets/${publishableSession.session.id}/publier`,
        sessionId: publishableSession.session.id,
        topicName: publishableSession.topic.name,
      }
      return Response.json(buildResponse(user, profile, counts, totalActiveSubjects, publishedTotal, step, recentSessions))
    }

    // (2) Session PENDING/RECORDING → record
    const recordingCandidate = enriched
      .flatMap((t) => t.sessions.map((s) => ({ topic: t, session: s })))
      .find(({ session }) => session.status === 'PENDING' || session.status === 'RECORDING')
    if (recordingCandidate) {
      const step: NextStep = {
        kind: 'record',
        label: 'Lancer le tournage',
        href: `/s/${recordingCandidate.session.id}`,
        sessionId: recordingCandidate.session.id,
        topicName: recordingCandidate.topic.name,
      }
      return Response.json(buildResponse(user, profile, counts, totalActiveSubjects, publishedTotal, step, recentSessions))
    }

    // (3) MATURE topic (ready, no active session) → prepare recording
    const matureTopic = enriched.find((t) => t.creativeState === 'MATURE')
    if (matureTopic) {
      const step: NextStep = {
        kind: 'prepare_recording',
        label: 'Préparer le tournage',
        href: `/chat?topicId=${matureTopic.id}&action=record`,
        topicId: matureTopic.id,
        topicName: matureTopic.name,
      }
      return Response.json(buildResponse(user, profile, counts, totalActiveSubjects, publishedTotal, step, recentSessions))
    }

    // (4) EXPLORING topic → continue
    const exploringTopic = enriched.find((t) => t.creativeState === 'EXPLORING')
    if (exploringTopic) {
      const step: NextStep = {
        kind: 'continue_exploring',
        label: 'Continuer à explorer',
        href: `/sujets/${exploringTopic.id}`,
        topicId: exploringTopic.id,
        topicName: exploringTopic.name,
      }
      return Response.json(buildResponse(user, profile, counts, totalActiveSubjects, publishedTotal, step, recentSessions))
    }

    // (5) SEED topic → start exploring
    const seedTopic = enriched.find((t) => t.creativeState === 'SEED')
    if (seedTopic) {
      const step: NextStep = {
        kind: 'seed_exploration',
        label: 'Explorer avec Kabou',
        href: `/sujets/${seedTopic.id}`,
        topicId: seedTopic.id,
        topicName: seedTopic.name,
      }
      return Response.json(buildResponse(user, profile, counts, totalActiveSubjects, publishedTotal, step, recentSessions))
    }

    // (6) Nothing yet → first subject
    const step: NextStep = {
      kind: 'first_subject',
      label: 'Créer ton premier Sujet avec Kabou',
      href: '/chat',
    }
    return Response.json(buildResponse(user, profile, counts, totalActiveSubjects, publishedTotal, step, recentSessions))
  } catch (err) {
    console.error('[home/state]', err)
    return new Response('Home indisponible', { status: 500 })
  }
}

function buildResponse(
  user: { firstName: string | null; email: string },
  profile: { thesis: unknown; editorialPillars: string[]; businessContext: unknown } | null,
  counts: Record<CreativeState, number>,
  totalActiveSubjects: number,
  publishedTotal: number,
  nextStep: NextStep,
  recentSessions: Array<{ submittedAt: Date | null; updatedAt: Date; status: string }>,
) {
  const thesis = (profile?.thesis ?? null) as ThesisShape | null
  const thesisReady =
    !!thesis &&
    typeof thesis.statement === 'string' &&
    thesis.statement.trim().length > 0
  const lastActivityAt =
    recentSessions[0]?.submittedAt ?? recentSessions[0]?.updatedAt ?? null

  return {
    userName: user.firstName || user.email.split('@')[0],
    thesis: thesisReady
      ? {
          statement: thesis!.statement!,
          confidence: thesis!.confidence ?? 'forming',
          audienceArchetype: thesis!.audienceArchetype ?? null,
        }
      : null,
    hasProfile:
      !!profile &&
      (Object.keys((profile.businessContext as object) ?? {}).length > 0 ||
        profile.editorialPillars.length > 0),
    nextStep,
    counts,
    totalActiveSubjects,
    publishedTotal,
    lastActivityAt,
  }
}
