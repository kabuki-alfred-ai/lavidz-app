import { recordingGuideHasSubstance, type RecordingGuide } from './recording-guide'
import { narrativeAnchorHasSubstance, type NarrativeAnchor } from './narrative-anchor'

/**
 * Creative state of a Sujet — the STRATEGIC axis (maturity of the idea).
 * Tactical states (recording/submitted/live) now live on `Session.status`,
 * not on the Topic anymore. The Topic axis has 4 stops only :
 *
 *   SEED → EXPLORING → MATURE → (ARCHIVED terminal)
 *
 * `SCHEDULED` and `PRODUCING` are REMOVED — they polluted the strategic
 * axis with per-session tactical noise. A Topic can perfectly be MATURE
 * and have 0, 1, or N sessions in any state without its own state moving.
 */
export type CreativeState =
  | 'SEED'
  | 'EXPLORING'
  | 'MATURE'
  | 'ARCHIVED'

export type SubjectStateInput = {
  topicStatus: 'DRAFT' | 'READY' | 'FILMING' | 'DONE' | 'ARCHIVED'
  brief: string | null
  narrativeAnchor?: NarrativeAnchor | null
  /** @deprecated utiliser `narrativeAnchor` — conservé pour dual-write pendant 1 sprint */
  recordingGuide?: RecordingGuide | null
}

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
  if (input.topicStatus === 'READY' || input.topicStatus === 'FILMING' || input.topicStatus === 'DONE') return 'MATURE'

  // DRAFT : un narrativeAnchor avec ≥ 3 bullets (ou le legacy recordingGuide
  // en pur draft) est un signal fort qu'un vrai travail éditorial a eu lieu.
  if (briefLooksRefined(input.brief)) return 'EXPLORING'
  if (narrativeAnchorHasSubstance(input.narrativeAnchor ?? null)) return 'EXPLORING'
  if (recordingGuideHasSubstance(input.recordingGuide ?? null)) return 'EXPLORING'
  return 'SEED'
}

export const CREATIVE_STATE_META: Record<
  CreativeState,
  { label: string; emoji: string; shortHint: string; color: string }
> = {
  SEED: {
    label: 'Graine',
    emoji: '🌱',
    shortHint: 'Idée à peine posée',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  EXPLORING: {
    label: 'Jeune pousse',
    emoji: '🌿',
    shortHint: 'En train de mûrir avec Kabou',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  MATURE: {
    label: 'Arbre',
    emoji: '🌳',
    shortHint: 'Prêt à être tourné',
    color: 'bg-emerald-600/15 text-emerald-700 border-emerald-600/25',
  },
  ARCHIVED: {
    label: 'Archivé',
    emoji: '📦',
    shortHint: 'Mis de côté',
    color: 'bg-muted text-muted-foreground border-border/40',
  },
}
