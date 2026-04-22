'use client'

import type { ReactElement } from 'react'
import type { CreativeState } from '@/lib/creative-state'
import { CheckCircle2 } from 'lucide-react'
import { SeedIcon, SproutIcon, TreeIcon } from './CreativeStageIcons'

type Stage = {
  key: 'SEED' | 'EXPLORING' | 'MATURE'
  label: string
  hint: string
  Icon: (props: { className?: string; active?: boolean }) => ReactElement
}

const STAGES: Stage[] = [
  { key: 'SEED',      label: 'Graine',       hint: 'Idée posée',        Icon: SeedIcon },
  { key: 'EXPLORING', label: 'Jeune pousse', hint: 'En train de mûrir', Icon: SproutIcon },
  { key: 'MATURE',    label: 'Arbre',        hint: 'Prêt à tourner',    Icon: TreeIcon },
]

// Mappe les 4 CreativeState sur la position "timeline" (0/1/2).
// ARCHIVED désature la timeline entière.
function getStageIndex(state: CreativeState): number {
  switch (state) {
    case 'SEED':      return 0
    case 'EXPLORING': return 1
    case 'MATURE':    return 2
    case 'ARCHIVED':  return -1
  }
}

export function CreativeStateTimeline({ state }: { state: CreativeState }) {
  const activeIdx = getStageIndex(state)
  const isArchived = state === 'ARCHIVED'
  const currentStage = activeIdx >= 0 ? STAGES[activeIdx] : null

  return (
    <div className="w-full">
      <div className={`flex items-center gap-2 ${isArchived ? 'opacity-40' : ''}`}>
        {STAGES.map((stage, i) => {
          const isDone = !isArchived && i < activeIdx
          const isActive = !isArchived && i === activeIdx
          const isTodo = isArchived || i > activeIdx

          const toneIcon = isActive
            ? 'text-primary'
            : isDone
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground/40'

          const toneLabel = isActive
            ? 'text-foreground font-semibold'
            : isDone
              ? 'text-muted-foreground'
              : 'text-muted-foreground/60'

          return (
            <div key={stage.key} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-full border transition ${
                    isActive
                      ? 'border-primary/40 bg-primary/5 shadow-sm ring-2 ring-primary/15'
                      : isDone
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-border/40 bg-surface-raised/20'
                  }`}
                >
                  <stage.Icon className={`h-9 w-9 ${toneIcon}`} active={isActive} />
                  {isDone && (
                    <CheckCircle2 className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <div className="text-center">
                  <p className={`text-xs leading-tight ${toneLabel}`}>{stage.label}</p>
                  {isActive && (
                    <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{stage.hint}</p>
                  )}
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={`h-px flex-1 transition ${
                    isDone ? 'bg-emerald-500/40' : 'bg-border/40'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {isArchived && currentStage === null && (
        <p className="mt-2 text-xs text-muted-foreground">Sujet archivé — mis de côté</p>
      )}
    </div>
  )
}
