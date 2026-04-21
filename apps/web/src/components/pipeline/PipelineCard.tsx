'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { PipelineStage } from '@/lib/pipeline-stage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SchedulePublishModal } from '@/components/subject/SchedulePublishModal'

export interface PipelineCardTopic {
  id: string
  name: string
  slug: string
  stage: PipelineStage
  readinessScore: number
  calendarEntries: Array<{
    id: string
    status: string
    publishAt: string | null
    sessionId: string | null
  }>
  sessions: Array<{ id: string; status: string }>
}

export interface PipelineCardProps {
  topic: PipelineCardTopic
  onChanged?: () => void
}

function formatFrDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export function PipelineCard({ topic, onChanged }: PipelineCardProps) {
  const router = useRouter()
  const [scheduling, setScheduling] = React.useState(false)
  const [modalOpen, setModalOpen] = React.useState(false)

  const latestSessionId = topic.sessions[0]?.id ?? null
  const nextPublishAt = topic.calendarEntries
    .filter((c) => c.publishAt)
    .map((c) => c.publishAt)
    .sort()[0] ?? null
  const publishLabel = formatFrDate(nextPublishAt)

  const recordNow = async () => {
    setScheduling(true)
    try {
      const res = await fetch(`/api/topics/${topic.id}/record-now`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = (await res.json()) as { sessionId: string }
        router.push(`/s/${data.sessionId}`)
      }
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-surface p-3 flex flex-col gap-2 text-sm">
      <Link
        href={`/sujets/${topic.id}`}
        className="font-medium text-foreground hover:underline line-clamp-2"
      >
        {topic.name}
      </Link>

      {topic.stage === 'TO_WORK' && (
        <>
          <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden">
            <div
              className="h-full bg-muted-foreground/40"
              style={{ width: `${Math.min(100, topic.readinessScore)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{topic.readinessScore}% prêt</span>
        </>
      )}

      {topic.stage === 'READY' && (
        <div className="flex flex-wrap gap-2 mt-1">
          <Button size="sm" onClick={recordNow} disabled={scheduling}>
            🎬 Tourner
          </Button>
          <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
            📅 Planifier
          </Button>
        </div>
      )}

      {topic.stage === 'SHOT' && latestSessionId && (
        <Link
          href={`/s/${latestSessionId}`}
          className="text-xs text-primary hover:underline"
        >
          Voir la session →
        </Link>
      )}

      {topic.stage === 'EDITING' && (
        <Link
          href={`/sujets/${topic.id}`}
          className="text-xs text-primary hover:underline"
        >
          Voir le montage →
        </Link>
      )}

      {topic.stage === 'PUBLISHED' && (
        <Badge variant="secondary" className="w-fit">
          🌍 Publié
        </Badge>
      )}

      {publishLabel && (
        <div className="text-xs text-muted-foreground mt-auto">
          Publi&nbsp;: {publishLabel}
        </div>
      )}

      {topic.stage === 'READY' && (
        <SchedulePublishModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          topicId={topic.id}
          onScheduled={onChanged}
        />
      )}
    </div>
  )
}
