'use client'

import { useEffect } from 'react'
import type { CreativeState } from '@/lib/creative-state'
import { SeedIcon, SproutIcon, TreeIcon } from '@/components/subject/CreativeStageIcons'

interface StateTransitionSplashProps {
  open: boolean
  onClose: () => void
  fromState: CreativeState | null
  toState: CreativeState
}

type Copy = { title: string; body: string; icon: 'seed' | 'sprout' | 'tree' | 'muted' }

/**
 * Mapping transition → wording Kabou + icône. Les 3 transitions qui
 * comptent ont leur propre copy ; les transitions rares ou techniques
 * retombent sur un fallback calme.
 */
function copyFor(from: CreativeState | null, to: CreativeState): Copy {
  const key = `${from ?? 'NULL'}->${to}`
  switch (key) {
    case 'SEED->EXPLORING':
      return {
        title: 'Ton sujet bourgeonne.',
        body: "On peut commencer à le sculpter. Je t'ouvre tes outils.",
        icon: 'sprout',
      }
    case 'EXPLORING->MATURE':
      return {
        title: 'Ton angle est solide.',
        body: 'Il est temps de choisir ta première prise de parole.',
        icon: 'tree',
      }
    case 'MATURE->ARCHIVED':
    case 'EXPLORING->ARCHIVED':
    case 'SEED->ARCHIVED':
      return {
        title: 'Ce sujet repose.',
        body: 'Je le garde au chaud.',
        icon: 'muted',
      }
    case 'ARCHIVED->SEED':
    case 'ARCHIVED->EXPLORING':
    case 'ARCHIVED->MATURE':
      return {
        title: 'On le ressort.',
        body: "Prêt à reprendre la matière là où tu l'avais laissée.",
        icon: to === 'MATURE' ? 'tree' : to === 'EXPLORING' ? 'sprout' : 'seed',
      }
    // Transition descendante sans archive (remise en exploration) — pas de splash
    // déclenché normalement, mais fallback doux si jamais.
    default:
      return {
        title: 'Ton sujet évolue.',
        body: 'On ajuste ensemble.',
        icon: to === 'MATURE' ? 'tree' : to === 'EXPLORING' ? 'sprout' : 'seed',
      }
  }
}

function IconFor({ icon }: { icon: Copy['icon'] }) {
  const baseClass = 'h-24 w-24'
  if (icon === 'seed') return <SeedIcon className={`${baseClass} text-amber-500 dark:text-amber-400`} active />
  if (icon === 'sprout')
    return <SproutIcon className={`${baseClass} text-emerald-500 dark:text-emerald-400`} active />
  if (icon === 'tree')
    return <TreeIcon className={`${baseClass} text-emerald-600 dark:text-emerald-400`} active />
  return <TreeIcon className={`${baseClass} text-muted-foreground`} />
}

/**
 * StateTransitionSplash — moment contemplatif 3.5s qui marque une bascule
 * réelle d'état Topic. Kabou témoigne, ne félicite pas.
 *
 * Comportement :
 * - Auto-dismiss après 3500ms.
 * - Skippable par click anywhere, touche Escape.
 * - `aria-live="polite"` pour annoncer le changement aux lecteurs d'écran
 *   sans interrompre.
 * - Entre via fade + scale, icône staggered, horizon line grandit.
 */
export function StateTransitionSplash({
  open,
  onClose,
  fromState,
  toState,
}: StateTransitionSplashProps) {
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(onClose, 3500)
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) return null

  const copy = copyFor(fromState, toState)

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur-xl px-8 cursor-pointer"
    >
      <div className="animate-splash-emerge">
        <IconFor icon={copy.icon} />
      </div>
      <h2
        className="animate-fade-in text-center text-2xl font-semibold tracking-tight"
        style={{ animationDelay: '200ms', animationFillMode: 'both' }}
      >
        {copy.title}
      </h2>
      <p
        className="animate-fade-in max-w-md text-center text-sm text-muted-foreground"
        style={{ animationDelay: '400ms', animationFillMode: 'both' }}
      >
        {copy.body}
      </p>
      <div
        className="animate-horizon-grow mt-2 h-px bg-primary/40"
        style={{ animationDelay: '600ms', animationFillMode: 'both' }}
      />
      <p
        className="animate-fade-in mt-6 text-[10px] uppercase tracking-widest text-muted-foreground/50"
        style={{ animationDelay: '1200ms', animationFillMode: 'both' }}
      >
        Clique pour continuer
      </p>
    </div>
  )
}
