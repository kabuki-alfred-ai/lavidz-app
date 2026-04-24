'use client'

import { Check } from 'lucide-react'
import { SignalsHelp } from './SubjectHelp'

export type SubjectSignal = {
  key: 'angle' | 'pillars' | 'sources' | 'hook'
  label: string
  hint: string
  done: boolean
}

interface SubjectSignalRailProps {
  signals: SubjectSignal[]
  onSignalClick?: (key: SubjectSignal['key']) => void
}

/**
 * Rail de 4 signaux nommés (angle / piliers / sources / hook). Ce n'est PAS un
 * score de complétude — on ne bloque jamais la bascule en Arbre. C'est un
 * tableau de bord : l'user voit d'un coup d'œil ce qui tient, ce qui manque,
 * et peut cliquer un signal éteint pour sauter vers la section à traiter.
 *
 * Intentionnellement discret visuellement (pas de % ni de jauge qui
 * gamifieraient). Les dots allumés = travail éditorial effectif, les dots
 * éteints = simple rappel qu'une brique est vide.
 */
export function SubjectSignalRail({ signals, onSignalClick }: SubjectSignalRailProps) {
  const doneCount = signals.filter((s) => s.done).length
  const allDone = doneCount === signals.length

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {signals.map((s, i) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onSignalClick?.(s.key)}
          title={s.hint}
          className={`group inline-flex items-center gap-1.5 px-2 py-1 text-[11.5px] rounded-full border transition ${
            s.done
              ? 'border-primary/35 text-primary bg-primary/[0.08] hover:bg-primary/[0.12]'
              : 'border-dashed border-border text-muted-foreground/70 hover:text-foreground hover:bg-surface-raised/50'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              s.done ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          />
          <span>{s.label}</span>
          {s.done && <Check className="h-2.5 w-2.5 opacity-70" />}
          {i < signals.length - 1 && (
            <span className="ml-1 h-px w-2 bg-border/60" aria-hidden />
          )}
        </button>
      ))}
      <span
        className={`text-[10px] font-mono tracking-widest uppercase ml-1 ${
          allDone ? 'text-primary' : 'text-muted-foreground/70'
        }`}
      >
        {doneCount}/{signals.length}
      </span>
      <SignalsHelp />
    </div>
  )
}
