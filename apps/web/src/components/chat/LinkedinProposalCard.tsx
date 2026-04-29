'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export type LinkedinProposal = {
  mood: 'challenger' | 'authentique' | 'expert'
  moodLabel: string
  sujet: string
  format: 'opinion_courte' | 'story' | 'expertise' | 'thought_leadership'
  formatLabel: string
  formatDuration: string
  coachingTip: string
  coachingExample: string
  pocketScriptBullets: [string, string, string]
  status?: string
}

interface LinkedinProposalCardProps {
  proposal: LinkedinProposal
  onValidate: (recordingMode: 'coached' | 'pocket_script') => void
  onOtherThing: () => void
}

export function LinkedinProposalCard({ proposal, onValidate, onOtherThing }: LinkedinProposalCardProps) {
  const [recordingMode, setRecordingMode] = useState<'coached' | 'pocket_script'>('coached')

  return (
    <div className="rounded-2xl border border-border/60 bg-surface-raised/40 p-4 space-y-4">
      {/* Mood + sujet */}
      <div className="space-y-2">
        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {proposal.moodLabel}
        </span>
        <h3 className="text-base font-bold leading-snug text-foreground">{proposal.sujet}</h3>
        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-xs text-muted-foreground">
          {proposal.formatLabel} · {proposal.formatDuration}
        </span>
      </div>

      {/* Mode de tournage */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Mode de tournage</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRecordingMode('coached')}
            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
              recordingMode === 'coached'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            Libre coaché
          </button>
          <button
            type="button"
            onClick={() => setRecordingMode('pocket_script')}
            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
              recordingMode === 'pocket_script'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/40'
            }`}
          >
            Script de poche
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" onClick={() => onValidate(recordingMode)}>
          Oui, on y va
        </Button>
        <Button size="sm" variant="outline" onClick={onOtherThing}>
          Autre chose
        </Button>
      </div>
    </div>
  )
}
