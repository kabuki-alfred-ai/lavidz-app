'use client'

import { Layers } from 'lucide-react'

interface KabouContextCardProps {
  angle: string | null
  pillarsCount: number
  sourcesCount: number
  sessionsSummary: string | null
}

/**
 * "Contexte chargé" — rend visible ce que Kabou a en tête au début de la
 * conversation (ce qu'il injecte côté backend dans le system prompt). Scrolle
 * avec les messages, PAS sticky, pour que l'user puisse vérifier le contexte
 * sans qu'il ne reste en permanence à l'écran.
 */
export function KabouContextCard({
  angle,
  pillarsCount,
  sourcesCount,
  sessionsSummary,
}: KabouContextCardProps) {
  const angleSnippet = angle?.split('\n').find((l) => l.trim().length > 0)?.trim()
  const hasAnything =
    !!angleSnippet || pillarsCount > 0 || sourcesCount > 0 || !!sessionsSummary
  if (!hasAnything) return null

  return (
    <div className="rounded-xl border border-border bg-surface-raised/40 p-3.5">
      <div className="flex items-center gap-2 mb-2 text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
        <Layers className="h-3 w-3" />
        Contexte chargé
      </div>
      <ul className="text-[12px] space-y-1">
        {angleSnippet && (
          <li className="flex gap-2 text-muted-foreground">
            <span className="opacity-50">·</span>
            <span className="line-clamp-1">{angleSnippet}</span>
          </li>
        )}
        {pillarsCount > 0 && (
          <li className="flex gap-2 text-muted-foreground">
            <span className="opacity-50">·</span>
            {pillarsCount} pilier{pillarsCount > 1 ? 's' : ''} narrati
            {pillarsCount > 1 ? 'fs' : 'f'} posé{pillarsCount > 1 ? 's' : ''}
          </li>
        )}
        {sourcesCount > 0 && (
          <li className="flex gap-2 text-muted-foreground">
            <span className="opacity-50">·</span>
            {sourcesCount} source{sourcesCount > 1 ? 's' : ''} ancrée
            {sourcesCount > 1 ? 's' : ''}
          </li>
        )}
        {sessionsSummary && (
          <li className="flex gap-2 text-muted-foreground">
            <span className="opacity-50">·</span>
            {sessionsSummary}
          </li>
        )}
      </ul>
    </div>
  )
}
