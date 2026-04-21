import type { ContentFormat } from '@lavidz/types'

/**
 * Fil conducteur d'enregistrement — discriminé par `kind`. Démarre toujours
 * en `draft` (3-5 bullets génériques tirées de la conversation Kabou), puis
 * se reshape vers la variante matchant le format de la session une fois
 * celui-ci choisi.
 *
 * Persisté dans `Topic.recordingGuide` (Json). Source de vérité des renderers
 * UI côté SubjectWorkspace + sidebar RecordingSession.
 */

export type RecordingGuideDraft = {
  kind: 'draft'
  bullets: string[]
}

export type RecordingGuideMythVsReality = {
  kind: 'myth_vs_reality'
  pairs: Array<{ myth: string; reality: string }>
}

export type RecordingGuideQA = {
  kind: 'qa'
  items: Array<{ question: string; keyPoints: string[] }>
}

export type StorytellingBeatLabel = 'setup' | 'tension' | 'climax' | 'resolution'
export type RecordingGuideStorytelling = {
  kind: 'storytelling'
  beats: Array<{ label: StorytellingBeatLabel; text: string }>
}

export type RecordingGuideHotTake = {
  kind: 'hot_take'
  thesis: string
  arguments: string[]
  punchline: string
}

export type RecordingGuideDailyTip = {
  kind: 'daily_tip'
  problem: string
  tip: string
  application: string
}

export type RecordingGuideTeleprompter = {
  kind: 'teleprompter'
  script: string
}

export type RecordingGuideKind =
  | 'draft'
  | 'myth_vs_reality'
  | 'qa'
  | 'storytelling'
  | 'hot_take'
  | 'daily_tip'
  | 'teleprompter'

type RecordingGuideVariant =
  | RecordingGuideDraft
  | RecordingGuideMythVsReality
  | RecordingGuideQA
  | RecordingGuideStorytelling
  | RecordingGuideHotTake
  | RecordingGuideDailyTip
  | RecordingGuideTeleprompter

export type RecordingGuideSourceDraft = { bullets: string[] }

export type RecordingGuide = RecordingGuideVariant & {
  // Traçabilité : on conserve le draft d'origine pour permettre un revert
  // ou une ré-adaptation vers un autre format sans repartir de zéro.
  sourceDraft?: RecordingGuideSourceDraft
  updatedAt?: string
}

export function isRecordingGuide(value: unknown): value is RecordingGuide {
  if (!value || typeof value !== 'object') return false
  const kind = (value as { kind?: unknown }).kind
  return (
    kind === 'draft' ||
    kind === 'myth_vs_reality' ||
    kind === 'qa' ||
    kind === 'storytelling' ||
    kind === 'hot_take' ||
    kind === 'daily_tip' ||
    kind === 'teleprompter'
  )
}

// Format → kind du guide attendu après reshape.
export const FORMAT_TO_GUIDE_KIND: Record<ContentFormat, Exclude<RecordingGuideKind, 'draft'>> = {
  MYTH_VS_REALITY: 'myth_vs_reality',
  QUESTION_BOX: 'qa',
  STORYTELLING: 'storytelling',
  HOT_TAKE: 'hot_take',
  DAILY_TIP: 'daily_tip',
  TELEPROMPTER: 'teleprompter',
}

export const GUIDE_KIND_LABELS: Record<RecordingGuideKind, string> = {
  draft: 'Fil conducteur (ébauche)',
  myth_vs_reality: 'Mythe vs Réalité',
  qa: 'Questions-Réponses',
  storytelling: 'Storytelling',
  hot_take: 'Prise de position',
  daily_tip: 'Conseil du jour',
  teleprompter: 'Téléprompteur',
}

/**
 * Signal utilisé par `deriveCreativeState` : un guide avec ≥ 3 bullets (draft
 * ou plus mature) indique qu'un vrai travail éditorial a eu lieu.
 */
export function recordingGuideHasSubstance(guide: RecordingGuide | null | undefined): boolean {
  if (!guide) return false
  switch (guide.kind) {
    case 'draft':
      return guide.bullets.filter((b) => b.trim().length > 0).length >= 3
    case 'myth_vs_reality':
      return guide.pairs.length >= 2
    case 'qa':
      return guide.items.length >= 2
    case 'storytelling':
      return guide.beats.length >= 3
    case 'hot_take':
      return guide.arguments.length >= 2 && guide.thesis.trim().length > 0
    case 'daily_tip':
      return guide.problem.trim().length > 0 && guide.tip.trim().length > 0
    case 'teleprompter':
      return guide.script.trim().length > 40
    default:
      return false
  }
}
