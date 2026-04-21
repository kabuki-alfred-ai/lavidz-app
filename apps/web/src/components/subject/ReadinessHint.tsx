'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Breakdown = {
  brief: number
  hooks: number
  recordingGuide: number
  sourcesOrPillar: number
  chosenHook: number
}

export interface ReadinessHintProps {
  topicId: string
  onMarkedReady?: () => void
}

export function ReadinessHint({ topicId, onMarkedReady }: ReadinessHintProps) {
  const router = useRouter()
  const [score, setScore] = React.useState<number | null>(null)
  const [breakdown, setBreakdown] = React.useState<Breakdown | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [marking, setMarking] = React.useState(false)

  const fetchReadiness = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/readiness`, { credentials: 'include' })
      if (res.ok) {
        const data = (await res.json()) as { score: number; breakdown: Breakdown }
        setScore(data.score)
        setBreakdown(data.breakdown)
      }
    } finally {
      setLoading(false)
    }
  }, [topicId])

  React.useEffect(() => {
    fetchReadiness()
  }, [fetchReadiness])

  const markReady = async () => {
    setMarking(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'READY' }),
      })
      if (res.ok) {
        onMarkedReady?.()
        router.refresh()
      }
    } finally {
      setMarking(false)
    }
  }

  if (loading || score === null) return null

  const pct = Math.min(100, Math.max(0, score))
  const ready = pct >= 80

  return (
    <div className="rounded-2xl border border-border/60 bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-muted-foreground">
            Maturité du sujet
          </span>
          <span className="text-lg font-semibold">{pct}%</span>
        </div>
        {ready && (
          <span className="text-sm">✨ Ton sujet semble prêt</span>
        )}
      </div>

      <div className="h-2 rounded-full bg-surface-raised overflow-hidden">
        <div
          className={`h-full transition-all ${ready ? 'bg-primary' : 'bg-muted-foreground/40'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {breakdown && (
        <ul className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
          <li>{breakdown.brief > 0 ? '✅' : '◯'} Brief rédigé</li>
          <li>{breakdown.hooks > 0 ? '✅' : '◯'} Hook proposé</li>
          <li>{breakdown.recordingGuide > 0 ? '✅' : '◯'} Guide tournage</li>
          <li>{breakdown.sourcesOrPillar > 0 ? '✅' : '◯'} Sources / pilier</li>
          <li>{breakdown.chosenHook > 0 ? '✅' : '◯'} Hook validé</li>
        </ul>
      )}

      <Button
        variant={ready ? 'default' : 'outline'}
        size="sm"
        onClick={markReady}
        disabled={marking}
      >
        {marking ? 'En cours…' : ready ? 'Marquer comme prêt' : 'Forcer ready'}
      </Button>
    </div>
  )
}
