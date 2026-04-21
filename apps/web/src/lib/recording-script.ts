import type { ContentFormat } from '@lavidz/types'

/**
 * RecordingScript — script tactique format-specific d'une Session.
 *
 * Vit sur `Session.recordingScript` (Json). Créé par reshape depuis
 * `Topic.narrativeAnchor` au moment où l'user choisit un format pour un
 * tournage. Polymorphe par `kind` (6 variantes format-specific, **pas de
 * variante `draft`** — tant qu'il n'y a pas eu reshape, la session n'a pas
 * de script et l'UI fallback sur `Topic.narrativeAnchor`).
 *
 * `anchorSyncedAt` est l'horodatage du reshape : il permet de comparer avec
 * `narrativeAnchor.updatedAt` pour détecter un script stale.
 * `sourceAnchorBullets` préserve la traçabilité vers l'anchor d'origine.
 */

export type RecordingScriptMythVsReality = {
  kind: 'myth_vs_reality'
  pairs: Array<{ myth: string; reality: string }>
}

export type RecordingScriptQA = {
  kind: 'qa'
  items: Array<{ question: string; keyPoints: string[] }>
}

export type StorytellingBeatLabel = 'setup' | 'tension' | 'climax' | 'resolution'
export type RecordingScriptStorytelling = {
  kind: 'storytelling'
  beats: Array<{ label: StorytellingBeatLabel; text: string }>
}

export type RecordingScriptHotTake = {
  kind: 'hot_take'
  thesis: string
  arguments: string[]
  punchline: string
}

export type RecordingScriptDailyTip = {
  kind: 'daily_tip'
  problem: string
  tip: string
  application: string
}

export type RecordingScriptTeleprompter = {
  kind: 'teleprompter'
  script: string
}

export type RecordingScriptKind =
  | 'myth_vs_reality'
  | 'qa'
  | 'storytelling'
  | 'hot_take'
  | 'daily_tip'
  | 'teleprompter'

type RecordingScriptVariant =
  | RecordingScriptMythVsReality
  | RecordingScriptQA
  | RecordingScriptStorytelling
  | RecordingScriptHotTake
  | RecordingScriptDailyTip
  | RecordingScriptTeleprompter

export type RecordingScript = RecordingScriptVariant & {
  anchorSyncedAt: string
  sourceAnchorBullets?: string[]
}

export function isRecordingScript(value: unknown): value is RecordingScript {
  if (!value || typeof value !== 'object') return false
  const v = value as { kind?: unknown; anchorSyncedAt?: unknown }
  if (typeof v.anchorSyncedAt !== 'string') return false
  return (
    v.kind === 'myth_vs_reality' ||
    v.kind === 'qa' ||
    v.kind === 'storytelling' ||
    v.kind === 'hot_take' ||
    v.kind === 'daily_tip' ||
    v.kind === 'teleprompter'
  )
}

/** Format ContentFormat → kind RecordingScript attendu après reshape. */
export const FORMAT_TO_SCRIPT_KIND: Record<ContentFormat, RecordingScriptKind> = {
  MYTH_VS_REALITY: 'myth_vs_reality',
  QUESTION_BOX: 'qa',
  STORYTELLING: 'storytelling',
  HOT_TAKE: 'hot_take',
  DAILY_TIP: 'daily_tip',
  TELEPROMPTER: 'teleprompter',
}

export const SCRIPT_KIND_LABELS: Record<RecordingScriptKind, string> = {
  myth_vs_reality: 'Mythe vs Réalité',
  qa: 'Questions-Réponses',
  storytelling: 'Storytelling',
  hot_take: 'Prise de position',
  daily_tip: 'Conseil du jour',
  teleprompter: 'Téléprompteur',
}

/** Un script est "substantiel" dès qu'il porte la matière attendue du format. */
export function recordingScriptHasSubstance(script: RecordingScript | null | undefined): boolean {
  if (!script) return false
  switch (script.kind) {
    case 'myth_vs_reality':
      return script.pairs.length >= 2
    case 'qa':
      return script.items.length >= 2
    case 'storytelling':
      return script.beats.length >= 3
    case 'hot_take':
      return script.arguments.length >= 2 && script.thesis.trim().length > 0
    case 'daily_tip':
      return script.problem.trim().length > 0 && script.tip.trim().length > 0
    case 'teleprompter':
      return script.script.trim().length > 40
    default:
      return false
  }
}
