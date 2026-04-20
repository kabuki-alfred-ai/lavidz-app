/**
 * Creative state of a Sujet — derived from its related entities (status, sessions,
 * calendar entries). This mirrors the six phases defined in the product plan
 * (project_lavidz_subject_atom_plan.md) without requiring a DB migration.
 *
 * The canonical ordering is:
 *   SEED → EXPLORING → MATURE → SCHEDULED → PRODUCING → (ARCHIVED terminal)
 */
export type CreativeState =
  | 'SEED'
  | 'EXPLORING'
  | 'MATURE'
  | 'SCHEDULED'
  | 'PRODUCING'
  | 'ARCHIVED'

export type SubjectStateInput = {
  topicStatus: 'DRAFT' | 'READY' | 'ARCHIVED'
  briefLength: number
  calendarEntriesCount: number
  sessions: Array<{ status: string }>
}

const PRODUCING_STATUSES = new Set(['PENDING', 'RECORDING', 'SUBMITTED', 'PROCESSING'])

export function deriveCreativeState(input: SubjectStateInput): CreativeState {
  if (input.topicStatus === 'ARCHIVED') return 'ARCHIVED'

  const hasProducingSession = input.sessions.some((s) => PRODUCING_STATUSES.has(s.status))
  if (hasProducingSession) return 'PRODUCING'

  if (input.topicStatus === 'READY') {
    return input.calendarEntriesCount > 0 ? 'SCHEDULED' : 'MATURE'
  }

  // DRAFT from here
  return input.briefLength >= 80 ? 'EXPLORING' : 'SEED'
}

export const CREATIVE_STATE_META: Record<
  CreativeState,
  { label: string; emoji: string; shortHint: string; color: string }
> = {
  SEED: {
    label: 'Graine',
    emoji: '💡',
    shortHint: 'Idée à peine posée',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  EXPLORING: {
    label: 'Exploration',
    emoji: '🌱',
    shortHint: 'En train de mûrir avec Kabou',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  MATURE: {
    label: 'Mûr',
    emoji: '🌳',
    shortHint: 'Prêt à être tourné',
    color: 'bg-emerald-600/15 text-emerald-700 border-emerald-600/25',
  },
  SCHEDULED: {
    label: 'Planifié',
    emoji: '📅',
    shortHint: 'Date calée dans ton planning',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  PRODUCING: {
    label: 'En production',
    emoji: '🎬',
    shortHint: 'Tournage en cours ou à finir',
    color: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  },
  ARCHIVED: {
    label: 'Archivé',
    emoji: '📦',
    shortHint: 'Mis de côté',
    color: 'bg-muted text-muted-foreground border-border/40',
  },
}
