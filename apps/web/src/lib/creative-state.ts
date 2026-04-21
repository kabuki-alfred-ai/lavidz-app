import { recordingGuideHasSubstance, type RecordingGuide } from './recording-guide'

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
  brief: string | null
  calendarEntriesCount: number
  sessions: Array<{ status: string }>
  recordingGuide?: RecordingGuide | null
}

const PRODUCING_STATUSES = new Set(['PENDING', 'RECORDING', 'SUBMITTED', 'PROCESSING'])

// Un brief auto-généré par le tool create_topic tient en une seule phrase de
// 2-3 phrases (~150-300 chars). On ne quitte la phase "Graine" que si le brief
// montre des signes d'un vrai travail éditorial : longueur > 400 chars, OU
// structure (retours à la ligne, listes markdown), OU ≥ 2 paragraphes.
function briefLooksRefined(brief: string | null): boolean {
  if (!brief) return false
  const trimmed = brief.trim()
  if (trimmed.length >= 400) return true
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  if (paragraphs.length >= 2) return true
  if (/^\s*([-*]|\d+\.)\s/m.test(trimmed)) return true
  return false
}

export function deriveCreativeState(input: SubjectStateInput): CreativeState {
  if (input.topicStatus === 'ARCHIVED') return 'ARCHIVED'

  const hasProducingSession = input.sessions.some((s) => PRODUCING_STATUSES.has(s.status))
  if (hasProducingSession) return 'PRODUCING'

  if (input.topicStatus === 'READY') {
    return input.calendarEntriesCount > 0 ? 'SCHEDULED' : 'MATURE'
  }

  // DRAFT from here : un recordingGuide avec ≥ 3 bullets est un signal fort
  // qu'un vrai travail éditorial a eu lieu, même si le brief n'a pas grossi.
  if (briefLooksRefined(input.brief)) return 'EXPLORING'
  if (recordingGuideHasSubstance(input.recordingGuide ?? null)) return 'EXPLORING'
  return 'SEED'
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
