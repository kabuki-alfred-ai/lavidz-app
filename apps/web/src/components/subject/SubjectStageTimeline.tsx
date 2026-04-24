'use client'

import type { CreativeState } from '@/lib/creative-state'
import { SeedIcon, SproutIcon, TreeIcon } from './CreativeStageIcons'
import { StageHelp } from './SubjectHelp'

type Stage = {
  key: 'SEED' | 'EXPLORING' | 'MATURE'
  label: string
  Icon: (props: { className?: string; active?: boolean }) => React.ReactElement
}

const STAGES: Stage[] = [
  { key: 'SEED',      label: 'Graine',       Icon: SeedIcon },
  { key: 'EXPLORING', label: 'Jeune pousse', Icon: SproutIcon },
  { key: 'MATURE',    label: 'Arbre',        Icon: TreeIcon },
]

function getStageIndex(state: CreativeState): number {
  switch (state) {
    case 'SEED':      return 0
    case 'EXPLORING': return 1
    case 'MATURE':    return 2
    case 'ARCHIVED':  return -1
  }
}

/**
 * Version compacte (3 silhouettes connectées par trait + label uppercase mono).
 * Utilisée dans le header de la page Sujet detail. La version full (cercles 56px
 * avec checks) reste disponible via CreativeStateTimeline pour les écrans qui la
 * veulent.
 */
export function SubjectStageTimeline({ state }: { state: CreativeState }) {
  const activeIdx = getStageIndex(state)
  const isArchived = state === 'ARCHIVED'
  const current = activeIdx >= 0 ? STAGES[activeIdx] : null

  return (
    <div className={`flex items-center gap-3 ${isArchived ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2.5">
        {STAGES.map((stage, i) => {
          const done = !isArchived && i < activeIdx
          const active = !isArchived && i === activeIdx
          const iconTone = active
            ? 'text-primary'
            : done
              ? 'text-foreground'
              : 'text-muted-foreground/40'
          return (
            <div key={stage.key} className="flex items-center gap-2.5">
              <div className="relative flex h-5 w-5 items-center justify-center">
                <stage.Icon className={`h-4 w-4 ${iconTone}`} active={active} />
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={`h-px w-[22px] ${done ? 'bg-foreground/60' : 'bg-border'}`}
                />
              )}
            </div>
          )
        })}
      </div>
      <span className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground">
        {isArchived ? 'Archivé' : current?.label}
      </span>
      <StageHelp />
    </div>
  )
}
