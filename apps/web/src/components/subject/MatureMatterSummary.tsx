'use client'

import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'

interface MatureMatterSummaryProps {
  briefLength: number
  anchorBulletCount: number
  hookCount: number
  sourcesCount: number
  hookDraftHasContent: boolean
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}

/**
 * MatureMatterSummary — en MATURE, plie les 4 sections éditoriales dans un
 * bandeau synthétique qui révèle la densité du travail sans l'étaler. Le
 * focus naturel de la page descend vers les cartes format + hero.
 *
 * Quand `expanded === false` : rend juste le bandeau synthétique.
 * Quand `expanded === true` : rend une barre "Replier" + les `children`
 * (les sections éditoriales vraies) en-dessous.
 */
export function MatureMatterSummary({
  briefLength,
  anchorBulletCount,
  hookCount,
  sourcesCount,
  hookDraftHasContent,
  expanded,
  onToggle,
  children,
}: MatureMatterSummaryProps) {
  const briefWords = briefLength > 0 ? Math.max(1, Math.round(briefLength / 5)) : 0
  const items: Array<{ label: string; active: boolean }> = [
    { label: briefWords > 0 ? `Angle · ${briefWords} mots` : 'Angle vide', active: briefWords > 0 },
    {
      label:
        anchorBulletCount > 0
          ? `Anchor · ${anchorBulletCount} bullet${anchorBulletCount > 1 ? 's' : ''}`
          : 'Anchor à poser',
      active: anchorBulletCount > 0,
    },
    {
      label:
        hookCount > 0
          ? `${hookCount} accroche${hookCount > 1 ? 's' : ''}`
          : hookDraftHasContent
            ? "Notes d'accroches"
            : 'Accroches à proposer',
      active: hookCount > 0 || hookDraftHasContent,
    },
    {
      label: sourcesCount > 0 ? `${sourcesCount} source${sourcesCount > 1 ? 's' : ''}` : 'Aucune source',
      active: sourcesCount > 0,
    },
  ]

  if (expanded) {
    return (
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Mon sujet en matière
          </h2>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ChevronUp className="h-3 w-3" />
            Replier la matière
          </button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="mb-6 w-full rounded-2xl border border-border/40 bg-surface-raised/20 px-5 py-4 text-left transition-colors hover:bg-surface-raised/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Mon sujet en matière
        </h2>
        <ul className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {items.map((item, i) => (
            <li
              key={i}
              className={`inline-flex items-center gap-1.5 ${
                item.active ? 'text-foreground/80' : 'italic text-muted-foreground/50'
              }`}
            >
              {i > 0 && (
                <span aria-hidden className="text-muted-foreground/30">
                  ·
                </span>
              )}
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <ChevronDown className="h-3 w-3" />
          Déplier
        </span>
      </div>
    </button>
  )
}
