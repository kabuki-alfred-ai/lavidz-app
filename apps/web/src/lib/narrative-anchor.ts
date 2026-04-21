/**
 * NarrativeAnchor — ancre narrative stratégique du Topic.
 *
 * Vit sur `Topic.narrativeAnchor`. Source de vérité long-terme de l'angle
 * éditorial du sujet. Shape strictement minimale — PAS polymorphe par format.
 * Les scripts format-specific (6 variantes) vivent sur `Session.recordingScript`
 * et sont modélisés par `RecordingScript` (cf. `./recording-script.ts`).
 *
 * Relation avec RecordingScript :
 *   Topic.narrativeAnchor ──(reshape via tool Kabou)──▶ Session.recordingScript
 *
 * Le champ `updatedAt` est field-level (F14) : c'est la source de vérité du
 * stale badge (on compare avec `Session.recordingScript.anchorSyncedAt`), PAS
 * `Topic.updatedAt` qui peut bouger pour d'autres raisons.
 */
export type NarrativeAnchor = {
  kind: 'draft'
  bullets: string[]
  updatedAt: string
}

export function isNarrativeAnchor(value: unknown): value is NarrativeAnchor {
  if (!value || typeof value !== 'object') return false
  const v = value as { kind?: unknown; bullets?: unknown; updatedAt?: unknown }
  return (
    v.kind === 'draft' &&
    Array.isArray(v.bullets) &&
    v.bullets.every((b) => typeof b === 'string') &&
    typeof v.updatedAt === 'string'
  )
}

/**
 * Signal utilisé par `deriveCreativeState` : un anchor avec ≥ 3 bullets
 * non-vides indique qu'un vrai travail éditorial a eu lieu.
 */
export function narrativeAnchorHasSubstance(anchor: NarrativeAnchor | null | undefined): boolean {
  if (!anchor) return false
  return anchor.bullets.filter((b) => b.trim().length > 0).length >= 3
}
