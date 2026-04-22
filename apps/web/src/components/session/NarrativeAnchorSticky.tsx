'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Compass } from 'lucide-react'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'

interface NarrativeAnchorStickyProps {
  anchor: NarrativeAnchor
  /** Max bullets affichés une fois déplié. 3 par défaut = "le cœur du sujet". */
  maxBullets?: number
}

/**
 * Sticky collapsible pendant le tournage : l'ancre narrative stratégique
 * du Topic reste toujours accessible sans gêner la caméra ni le script.
 * Mode compact permanent (style sobre surimposition vidéo), collapsible
 * pour se replier en simple label si l'entrepreneur veut plus d'espace.
 */
export function NarrativeAnchorSticky({ anchor, maxBullets = 3 }: NarrativeAnchorStickyProps) {
  const [open, setOpen] = useState(true)
  const bullets = anchor.bullets.filter((b) => b.trim().length > 0).slice(0, maxBullets)
  if (bullets.length === 0) return null

  return (
    <aside
      className="pointer-events-auto absolute bottom-4 left-4 right-4 z-30 mx-auto max-w-md rounded-2xl border text-white shadow-2xl"
      style={{
        background: 'rgba(14,14,14,0.82)',
        borderColor: 'rgba(255,255,255,0.12)',
        backdropFilter: 'blur(10px)',
      }}
      aria-label="Ton angle narratif"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider"
      >
        <Compass className="h-3.5 w-3.5 opacity-80" />
        <span className="flex-1">🧭 Ton angle</span>
        {open ? <ChevronDown className="h-3 w-3 opacity-70" /> : <ChevronUp className="h-3 w-3 opacity-70" />}
      </button>
      {open && (
        <ul className="space-y-1.5 border-t px-3 py-2.5 text-[13px] leading-snug"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="select-none opacity-60">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
