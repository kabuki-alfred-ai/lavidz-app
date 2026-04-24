'use client'

/**
 * Chip "tenter un autre format" — le clic ouvre le drawer du format (preview
 * script complet + options Lancer/Planifier) au lieu de créer la session
 * immédiatement. Permet à l'entrepreneur de voir ce qu'il va tourner AVANT de
 * s'engager, et d'accéder au choix "maintenant vs plus tard" qui n'était
 * quasi-invisible autrement.
 */
export function FormatChipButton({
  format,
  emoji,
  label,
  onExplore,
}: {
  format: string
  emoji: string
  label: string
  onExplore: (format: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onExplore(format)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-surface-raised/30 px-3 py-1 text-xs transition hover:bg-surface-raised/60"
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </button>
  )
}
