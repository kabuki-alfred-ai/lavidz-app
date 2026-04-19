'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Film, CalendarDays, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LinkedInPostsSection } from '@/components/social/LinkedInPostsSection'

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

function SessionCard({ session, authorName }: { session: SessionVideo; authorName: string }) {
  const [expanded, setExpanded] = useState(true)
  const canGeneratePosts = session.status === 'DONE'

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

          <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>

        {expanded && (
          <>
            <RushesPanel sessionId={session.id} />
            <div className="px-4 pb-4 pt-2 border-t border-border/30">
              <LinkedInPostsSection
                endpoint={`/api/sessions/${session.id}/linkedin-posts`}
                authorName={authorName}
                authorTitle={session.theme?.name}
                generateLabel="Générer un post LinkedIn depuis cette vidéo"
                disabled={!canGeneratePosts}
                disabledReason="Disponible une fois la vidéo enregistrée et transcrite (statut DONE)."
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function ClientVideos({ authorName = 'Vous' }: { authorName?: string }) {
  const [sessions, setSessions] = useState<SessionVideo[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sessions/submitted', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const list: SessionVideo[] = Array.isArray(data) ? data : data.data ?? []
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setSessions(list)
      }
    } catch { /* */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-lg font-bold tracking-tight">Mes videos</h1>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-raised animate-pulse rounded-xl" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="space-y-2">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} authorName={authorName} />
          ))}
        </div>
      )}
    </div>
  )
}
