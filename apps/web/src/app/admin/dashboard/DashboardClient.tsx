'use client'

import React, { useState, useEffect } from 'react'
import { CalendarDays, Video, TrendingUp, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type CalendarEntry = {
  id: string
  date: string
  topic: string
  format: string
  status: string
  sessionId?: string | null
}

type Session = {
  id: string
  createdAt: string
  status: string
  theme?: { name: string } | null
  themeName?: string
}

export function DashboardClient() {
  const [nextEntry, setNextEntry] = useState<CalendarEntry | null>(null)
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [totalDone, setTotalDone] = useState(0)
  const [thisMonth, setThisMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [calRes, sessRes] = await Promise.all([
          fetch('/api/admin/content-calendar', { credentials: 'include' }),
          fetch('/api/admin/sessions/submitted', { credentials: 'include' }),
        ])

        if (calRes.ok) {
          const calData = await calRes.json()
          const entries: CalendarEntry[] = Array.isArray(calData) ? calData : calData.entries ?? []
          const now = new Date()
          const planned = entries
            .filter((e) => e.status === 'PLANNED' && new Date(e.date) >= now)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          setNextEntry(planned[0] ?? null)
        }

        if (sessRes.ok) {
          const sessData = await sessRes.json()
          const sessions: Session[] = Array.isArray(sessData) ? sessData : sessData.sessions ?? []
          setRecentSessions(sessions.slice(0, 3))

          const done = sessions.filter((s) => s.status === 'DONE').length
          setTotalDone(done)

          const nowMonth = new Date().getMonth()
          const nowYear = new Date().getFullYear()
          const monthly = sessions.filter((s) => {
            const d = new Date(s.createdAt)
            return d.getMonth() === nowMonth && d.getFullYear() === nowYear
          }).length
          setThisMonth(monthly)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20 justify-center">
        <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground">Chargement...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-[1px] bg-primary/40" />
          <p className="text-xs text-primary/60">
            Accueil
          </p>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
      </div>

      {/* Section 1: Prochain enregistrement */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium text-muted-foreground">
          Prochain enregistrement
        </h2>
        {nextEntry ? (
          <Card>
            <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <p className="text-lg font-black uppercase tracking-tight text-foreground">
                  {nextEntry.topic}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={12} />
                    {new Date(nextEntry.date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </span>
                  <Badge variant="outline">{nextEntry.format}</Badge>
                </div>
              </div>
              {nextEntry.sessionId ? (
                <Link
                  href={`/record/${nextEntry.sessionId}`}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
                >
                  <Video size={14} />
                  S&apos;enregistrer
                </Link>
              ) : (
                <span className="flex items-center gap-2 border border-border px-6 py-3 rounded-lg text-xs text-muted-foreground shrink-0">
                  <CalendarDays size={14} />
                  Planifie
                </span>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-xs text-muted-foreground">
                Aucun enregistrement planifie.{' '}
                <Link href="/admin/calendar" className="text-primary hover:underline">
                  Planifie ton calendrier
                </Link>
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Section 2: Dernieres videos */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-muted-foreground">
            Dernieres videos
          </h2>
          <Link
            href="/admin/montage"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Voir tout
            <ChevronRight size={10} />
          </Link>
        </div>
        {recentSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentSessions.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm font-bold text-foreground truncate">
                    {s.theme?.name ?? s.themeName ?? 'Session'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <Badge variant={s.status === 'DONE' ? 'active' : 'secondary'}>
                      {s.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-xs text-muted-foreground">Aucune video pour le moment.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Section 3: Statistiques rapides */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium text-muted-foreground">
          Statistiques rapides
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-primary/10 rounded-lg">
                <Video size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">{totalDone}</p>
                <p className="text-xs text-muted-foreground">
                  Videos produites
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-primary/10 rounded-lg">
                <CalendarDays size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">{thisMonth}</p>
                <p className="text-xs text-muted-foreground">
                  Ce mois
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-primary/10 rounded-lg">
                <TrendingUp size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground">{recentSessions.length}</p>
                <p className="text-xs text-muted-foreground">
                  Sessions recentes
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
