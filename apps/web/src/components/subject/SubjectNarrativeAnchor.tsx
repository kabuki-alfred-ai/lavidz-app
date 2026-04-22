'use client'

import { ListChecks } from 'lucide-react'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'

interface SubjectNarrativeAnchorProps {
  anchor: NarrativeAnchor
  compact?: boolean
}

/**
 * Renderer bullets-only de l'ancre narrative stratégique (`Topic.narrativeAnchor`).
 * Volontairement simple — pas de polymorphisme format-specific. Pour un script
 * adapté à un format de tournage, voir `SubjectRecordingScript` (renderer
 * polymorphe sur 6 kinds).
 */
export function SubjectNarrativeAnchor({ anchor, compact = false }: SubjectNarrativeAnchorProps) {
  const wrapperClass = compact
    ? 'rounded-xl border border-border/40 bg-card/60 p-3 text-xs'
    : 'rounded-2xl border border-border/50 bg-surface-raised/30 p-5 text-sm'

  const headerClass = compact
    ? 'mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground'
    : 'mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground'

  const bullets = anchor.bullets.filter((b) => b.trim().length > 0)

  return (
    <section className={wrapperClass}>
      <h2 className={headerClass}>
        <ListChecks className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        🧭 Ton angle
      </h2>
      {bullets.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          Pas encore d'angle posé — discute avec Kabou pour en faire émerger un.
        </p>
      ) : (
        <ul className={compact ? 'space-y-1.5' : 'space-y-2'}>
          {bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2">
              <span className="select-none text-muted-foreground">•</span>
              <span className="leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
