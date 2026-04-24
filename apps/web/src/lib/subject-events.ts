import { prisma } from '@lavidz/database'

export type SubjectEventActor = 'user' | 'kabou' | 'system'

export type SubjectEventType =
  | 'topic_created'
  | 'brief_edited'
  | 'status_changed'
  | 'pillar_changed'
  | 'narrative_anchor_edited'
  | 'source_added'
  | 'source_removed'
  | 'sources_searched'
  | 'session_created'
  | 'recording_added'
  | 'schedule_published'
  | 'kabou_enriched'

interface RecordOptions {
  topicId: string
  type: SubjectEventType | string
  actor?: SubjectEventActor
  metadata?: Record<string, unknown>
}

/**
 * Écrit une ligne dans SubjectEvent. Appelé depuis les routes API qui mutent
 * un Topic (proxy Next.js vers NestJS) et depuis le onFinish du chat Kabou
 * après un tool call réussi. Best-effort : une erreur d'écriture n'est jamais
 * remontée au caller — le fil est informatif, pas bloquant.
 */
export async function recordSubjectEvent({
  topicId,
  type,
  actor = 'user',
  metadata,
}: RecordOptions): Promise<void> {
  try {
    await prisma.subjectEvent.create({
      data: {
        topicId,
        type,
        actor,
        // Cast: Prisma's InputJsonValue is structurally stricter than our
        // open-ended `Record<string, unknown>`, but the runtime shape is JSON
        // by construction (we only pass primitives + plain objects).
        metadata: (metadata ?? undefined) as unknown as Parameters<
          typeof prisma.subjectEvent.create
        >[0]['data']['metadata'],
      },
    })
  } catch (err) {
    console.error('[subject-events] write failed', { topicId, type, err })
  }
}

/**
 * Helper de lecture — dernière page du fil d'un sujet, le plus récent d'abord.
 * Utilisé par la page Sujet en server-side pour éviter un round-trip client.
 */
export async function readSubjectEvents(
  topicId: string,
  limit = 50,
): Promise<
  Array<{
    id: string
    type: string
    actor: string
    metadata: unknown
    createdAt: string
  }>
> {
  const rows = await prisma.subjectEvent.findMany({
    where: { topicId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    actor: r.actor,
    metadata: r.metadata,
    createdAt: r.createdAt.toISOString(),
  }))
}
