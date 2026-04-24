'use client'

import type { ReactNode } from 'react'
import { Clock, Film, Pencil, Target, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CreativeState } from '@/lib/creative-state'
import { SubjectStageTimeline } from './SubjectStageTimeline'
import { SubjectSignalRail, type SubjectSignal } from './SubjectSignalRail'

interface SubjectHeaderProps {
  creativeState: CreativeState
  title: string
  subtitle?: string | null
  pillar: string | null
  onEditPillar: () => void
  nextScheduledDate?: string | null
  nextScheduledLabel?: string | null
  sessionsCount: number
  onScrollToSessions: () => void
  primaryCta?: ReactNode
  onRest?: () => void
  restDisabled?: boolean
  isArchived: boolean
  signals?: SubjectSignal[]
  onSignalClick?: (key: SubjectSignal['key']) => void
}

export function SubjectHeader({
  creativeState,
  title,
  subtitle,
  pillar,
  onEditPillar,
  nextScheduledDate,
  nextScheduledLabel,
  sessionsCount,
  onScrollToSessions,
  primaryCta,
  onRest,
  restDisabled,
  isArchived,
  signals,
  onSignalClick,
}: SubjectHeaderProps) {
  return (
    <div className="mb-8">
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <SubjectStageTimeline state={creativeState} />
        {signals && signals.length > 0 && !isArchived && (
          <div className="flex items-center">
            <span className="h-4 w-px bg-border mx-2" aria-hidden />
            <SubjectSignalRail signals={signals} onSignalClick={onSignalClick} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {pillar ? (
          <button
            type="button"
            onClick={onEditPillar}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] border border-border rounded-full text-muted-foreground bg-surface-raised/50 hover:bg-surface-raised transition"
          >
            <Target className="h-3 w-3" />
            {pillar}
          </button>
        ) : (
          <button
            type="button"
            onClick={onEditPillar}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] border border-dashed border-border rounded-full text-muted-foreground hover:bg-surface-raised/50 transition"
          >
            <Pencil className="h-3 w-3" />
            Lier à un domaine
          </button>
        )}
        {nextScheduledLabel && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] border border-border rounded-full text-muted-foreground bg-surface-raised/50">
            <Clock className="h-3 w-3" />
            {nextScheduledLabel}
          </span>
        )}
        {sessionsCount > 0 && (
          <button
            type="button"
            onClick={onScrollToSessions}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] border border-border rounded-full text-muted-foreground bg-surface-raised/50 hover:bg-surface-raised transition"
          >
            <Film className="h-3 w-3" />
            {sessionsCount} tournage{sessionsCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <h1 className="text-[32px] sm:text-[44px] lg:text-[52px] leading-[1.04] font-bold tracking-tight max-w-[720px] mb-4">
        {title}
      </h1>

      {subtitle && (
        <p className="text-[16px] leading-relaxed text-muted-foreground max-w-[640px] mb-7">
          {subtitle}
        </p>
      )}

      {(primaryCta || (onRest && !isArchived)) && (
        <div className="flex items-center gap-3 flex-wrap">
          {primaryCta}
          {onRest && !isArchived && (
            <Button variant="ghost" size="sm" onClick={onRest} disabled={restDisabled}>
              <RotateCcw className="h-3.5 w-3.5" />
              Remettre au repos
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
