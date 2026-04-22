'use client'

import type { ReactElement } from 'react'
import type { CreativeState } from '@/lib/creative-state'

/**
 * Illustrations SVG du cycle de vie d'un Sujet : graine → jeune pousse → arbre.
 * Partagées entre la timeline du workspace et la liste des sujets pour garder
 * un langage visuel unique. Les SVG respectent `currentColor` pour hériter
 * d'une couleur donnée par le parent via Tailwind (`text-*`).
 */

export function SeedIcon({ className, active = false }: { className?: string; active?: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M6 40 Q24 36 42 40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.35" />
      {active && (
        <g className="text-muted-foreground">
          <path d="M4 14 Q10 12 16 14" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" className="animate-wind-gust" />
          <path d="M30 22 Q38 20 46 22" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" className="animate-wind-gust-delayed" />
        </g>
      )}
      <g className={active ? 'animate-seed-pulse' : undefined}>
        <path d="M16 26 C16 34 32 34 32 26 C32 22 28 22 24 22 C20 22 16 22 16 26 Z" fill="currentColor" />
        <path d="M15 24 Q15 16 24 16 Q33 16 33 24 Z" fill="currentColor" opacity="0.65" />
        <path d="M15 24 Q24 26 33 24" stroke="hsl(var(--background))" strokeWidth="0.8" fill="none" opacity="0.35" />
        <circle cx="20" cy="21" r="0.8" fill="hsl(var(--background))" opacity="0.4" />
        <circle cx="24" cy="19" r="0.8" fill="hsl(var(--background))" opacity="0.4" />
        <circle cx="28" cy="21" r="0.8" fill="hsl(var(--background))" opacity="0.4" />
        <path d="M24 16 L24 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export function SproutIcon({ className, active = false }: { className?: string; active?: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M6 42 Q24 38 42 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.35" />
      {active && (
        <g className="text-muted-foreground">
          <path d="M2 16 Q8 14 14 16" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" className="animate-wind-gust" />
          <path d="M34 24 Q41 22 48 24" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" className="animate-wind-gust-delayed" />
        </g>
      )}
      <g className={active ? 'animate-sprout-sway' : undefined}>
        <path d="M24 42 Q24 32 23 22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <g className={active ? 'animate-leaf-flutter' : undefined}>
          <path d="M23 30 C16 28 12 24 11 20 C16 20 22 24 23 30 Z" fill="currentColor" />
        </g>
        <g className={active ? 'animate-leaf-flutter-delayed' : undefined}>
          <path d="M23 24 C30 22 34 18 35 14 C30 14 24 18 23 24 Z" fill="currentColor" />
        </g>
      </g>
    </svg>
  )
}

export function TreeIcon({ className, active = false }: { className?: string; active?: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M6 42 Q24 38 42 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.35" />
      {active && (
        <g className="text-muted-foreground">
          <path d="M1 12 Q7 10 13 12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" className="animate-wind-gust" />
          <path d="M36 20 Q42 18 48 20" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" className="animate-wind-gust-delayed" />
        </g>
      )}
      <g className={active ? 'animate-tree-rustle' : undefined}>
        <path d="M22 42 L22 28 M26 42 L26 28" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <g className={active ? 'animate-leaf-flutter-slow' : undefined}>
          <circle cx="24" cy="18" r="10" fill="currentColor" />
        </g>
        <g className={active ? 'animate-leaf-flutter' : undefined}>
          <circle cx="15" cy="22" r="7.5" fill="currentColor" opacity="0.88" />
        </g>
        <g className={active ? 'animate-leaf-flutter-delayed' : undefined}>
          <circle cx="33" cy="22" r="7.5" fill="currentColor" opacity="0.88" />
        </g>
      </g>
    </svg>
  )
}

/**
 * Visuel unifié par état stratégique Topic (4 états). Les anciens états
 * tactiques SCHEDULED et PRODUCING ont été retirés — ils vivent désormais
 * sur Session.status (LIVE, REPLACED, RECORDING, etc.).
 */
export type CreativeStageVisual = {
  label: string
  hint: string
  Icon: (props: { className?: string; active?: boolean }) => ReactElement
  textColor: string
  bgClass: string
  borderClass: string
}

export function getCreativeStageVisual(state: CreativeState): CreativeStageVisual {
  switch (state) {
    case 'SEED':
      return {
        label: 'Graine',
        hint: 'Idée posée',
        Icon: SeedIcon,
        textColor: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/25',
      }
    case 'EXPLORING':
      return {
        label: 'Jeune pousse',
        hint: 'En train de mûrir',
        Icon: SproutIcon,
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-500/10',
        borderClass: 'border-emerald-500/25',
      }
    case 'MATURE':
      return {
        label: 'Arbre',
        hint: 'Prêt à tourner',
        Icon: TreeIcon,
        textColor: 'text-emerald-700 dark:text-emerald-300',
        bgClass: 'bg-emerald-600/15',
        borderClass: 'border-emerald-600/30',
      }
    case 'ARCHIVED':
      return {
        label: 'Archivé',
        hint: 'Mis de côté',
        Icon: TreeIcon,
        textColor: 'text-muted-foreground',
        bgClass: 'bg-muted/40',
        borderClass: 'border-border/40',
      }
  }
}
