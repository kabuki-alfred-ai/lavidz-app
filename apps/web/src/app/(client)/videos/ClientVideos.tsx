'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Film, Loader2, CheckCircle2, XCircle, CalendarDays, ChevronDown, Play } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface SessionVideo {
  id: string
  status: 'PENDING' | 'RECORDING' | 'PROCESSING' | 'DONE' | 'FAILED'
  theme?: { name: string } | null
  createdAt: string
  contentFormat?: string | null
}

interface Rush {
  id: string
  questionText: string
  questionOrder: number
  signedUrl: string
}

type StatusGroup = 'in_progress' | 'done' | 'failed'

const STATUS_META: Record<StatusGroup, { label: string; icon: typeof Film; badgeClass: string; badgeLabel: string }> = {
  in_progress: {
    label: 'En montage',
    icon: Loader2,
    badgeClass: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
    badgeLabel: 'En cours',
  },
  done: {
    label: 'Livrees',
    icon: CheckCircle2,
    badgeClass: 'border-green-500/40 bg-green-500/10 text-green-400',
    badgeLabel: 'Livre',
  },
  failed: {
    label: 'Echecs',
    icon: XCircle,
    badgeClass: 'border-red-500/40 bg-red-500/10 text-red-400',
    badgeLabel: 'Echec',
  },
}

function getGroup(status: SessionVideo['status']): StatusGroup {
  if (status === 'DONE') return 'done'
  if (status === 'FAILED') return 'failed'
  return 'in_progress'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/* ------------------------------------------------------------------ */
/* Rush viewer                                                         */
/* ------------------------------------------------------------------ */

function RushesPanel({ sessionId }: { sessionId: string }) {
  const [rushes, setRushes] = useState<Rush[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/sessions/${sessionId}/recordings`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRushes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="px-4 pb-4 space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (rushes.length === 0) {
    return (
      <div className="px-4 pb-4">
        <p className="text-xs text-muted-foreground text-center py-4">Aucun rush disponible</p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      {rushes.map((rush) => (
        <div key={rush.id} className="rounded-xl overflow-hidden bg-black">
          <video
            src={rush.signedUrl}
            controls
            preload="metadata"
            className="w-full aspect-video"
          />
          <div className="px-3 py-2 bg-muted/10">
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">Q{rush.questionOrder + 1}</span> — {rush.questionText}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Session card                                                        */
/* ------------------------------------------------------------------ */

function SessionCard({ session, meta, groupKey }: { session: SessionVideo; meta: typeof STATUS_META['done']; groupKey: StatusGroup }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardContent className="p-0">
        <div
          className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-sm font-medium truncate">
              {session.theme?.name ?? 'Video'}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(session.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge className={meta.badgeClass}>{meta.badgeLabel}</Badge>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {expanded && <RushesPanel sessionId={session.id} />}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function ClientVideos() {
  const [sessions, setSessions] = useState<SessionVideo[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sessions/submitted', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setSessions(Array.isArray(data) ? data : data.data ?? [])
      }
    } catch { /* */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const grouped = useMemo(() => {
    const groups: Record<StatusGroup, SessionVideo[]> = { in_progress: [], done: [], failed: [] }
    for (const s of sessions) groups[getGroup(s.status)].push(s)
    for (const key of Object.keys(groups) as StatusGroup[]) {
      groups[key].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return groups
  }, [sessions])

  if (!loading && sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Film size={20} className="text-primary" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Pas encore de videos. Enregistre-toi depuis le calendrier !
        </p>
        <Link href="/calendar">
          <Button size="sm"><CalendarDays size={14} /> Voir le calendrier</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-lg font-bold tracking-tight">Mes videos</h1>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-raised animate-pulse rounded-xl" />
          ))}
        </div>
      )}

      {!loading &&
        (['in_progress', 'done', 'failed'] as StatusGroup[]).map((groupKey) => {
          const items = grouped[groupKey]
          if (items.length === 0) return null
          const meta = STATUS_META[groupKey]
          const GroupIcon = meta.icon

          return (
            <div key={groupKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <GroupIcon
                  size={14}
                  className={
                    groupKey === 'in_progress' ? 'text-yellow-400 animate-spin'
                    : groupKey === 'done' ? 'text-green-400'
                    : 'text-red-400'
                  }
                />
                <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
                  {meta.label} ({items.length})
                </h2>
              </div>

              <div className="space-y-1.5">
                {items.map((session) => (
                  <SessionCard key={session.id} session={session} meta={meta} groupKey={groupKey} />
                ))}
              </div>
            </div>
          )
        })}
    </div>
  )
}
