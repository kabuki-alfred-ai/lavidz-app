'use client'

import type { CreativeState } from '@/lib/creative-state'

interface TopicAtmosphereProps {
  state: CreativeState
}

const STATE_GRADIENTS: Record<CreativeState, string> = {
  // Ambre doux — "graine, chaleur, point de départ"
  SEED:
    'bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(251,191,36,0.12),rgba(251,191,36,0.04)_45%,transparent_70%)]',
  // Vert frais — "pousse, progression, jeune vigueur"
  EXPLORING:
    'bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(52,211,153,0.14),rgba(52,211,153,0.04)_45%,transparent_70%)]',
  // Vert profond — "arbre, stabilité, plein milieu de vie"
  MATURE:
    'bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(5,150,105,0.16),rgba(5,150,105,0.05)_45%,transparent_70%)]',
  // Gris muet — "repos, silence, mis de côté"
  ARCHIVED:
    'bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(148,163,184,0.18),rgba(148,163,184,0.05)_45%,transparent_70%)]',
}

/**
 * TopicAtmosphere — gradient radial subtil derrière le workspace, dont la
 * teinte dérive de la phase créative du Topic. Respire en douceur (9s) via
 * keyframe `atmosphere-pulse`. La transition entre teintes se fait en
 * cross-fade CSS naturel à chaque mount/update du state.
 *
 * Décoratif pur : pointer-events-none, aria-hidden, placé sous tout le
 * contenu via `-z-10`. Le container de la page (SubjectWorkspace) doit
 * avoir `relative` OU l'atmosphère sera relative au viewport — ce qui
 * convient car elle simule un éclairage ambient de haut en bas.
 */
export function TopicAtmosphere({ state }: TopicAtmosphereProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[80vh] overflow-hidden"
    >
      <div
        className={`h-full w-[120vw] -translate-x-[10vw] animate-atmosphere-pulse transition-colors duration-[2000ms] ease-out ${STATE_GRADIENTS[state]}`}
      />
    </div>
  )
}
