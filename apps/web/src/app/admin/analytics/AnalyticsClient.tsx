'use client'

import React, { useState, useEffect } from 'react'
import { BarChart3, Video, CalendarDays, Clock, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FORMAT_CONFIGS, type ContentFormat } from '@lavidz/types'

type Session = {
  id: string
  createdAt: string
  status: string
  theme?: { name: string } | null
  themeName?: string
}

type CalendarEntry = {
  id: string
  format: ContentFormat
  status: string
}

const FORMAT_COLORS: Record<string, string> = {
  QUESTION_BOX: 'bg-blue-500',
  TELEPROMPTER: 'bg-purple-500',
  HOT_TAKE: 'bg-orange-500',
  STORYTELLING: 'bg-emerald-500',
  DAILY_TIP: 'bg-yellow-500',
}

export function AnalyticsClient() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [sessRes, calRes] = await Promise.all([
          fetch('/api/admin/sessions/submitted', { credentials: 'include' }),
          fetch('/api/admin/content-calendar', { credentials: 'include' }),
        ])

        if (sessRes.ok) {
          const data = await sessRes.json()
          setSessions(Array.isArray(data) ? data : data.sessions ?? [])
        }

        if (calRes.ok) {
          const data = await calRes.json()
          setCalendarEntries(Array.isArray(data) ? data : data.entries ?? [])
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

  const totalDone = sessions.filter((s) => s.status === 'DONE').length
  const nowMonth = new Date().getMonth()
  const nowYear = new Date().getFullYear()
  const thisMonth = sessions.filter((s) => {
    const d = new Date(s.createdAt)
    return d.getMonth() === nowMonth && d.getFullYear() === nowYear
  }).length
  const submitted = sessions.filter((s) => s.status === 'SUBMITTED').length
  const planned = calendarEntries.filter((e) => e.status === 'PLANNED').length

  // Format distribution
  const formatCounts: Record<string, number> = {}
  calendarEntries.forEach((e) => {
    formatCounts[e.format] = (formatCounts[e.format] || 0) + 1
  })
  const maxFormatCount = Math.max(...Object.values(formatCounts), 1)

  // Recent sessions
  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <div className="max-w-4xl space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-[1px] bg-primary/40" />
          <p className="text-xs text-primary/60">
            Donnees
          </p>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Vue d&apos;ensemble de ton activite
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="w-9 h-9 flex items-center justify-center bg-emerald-500/10 rounded-lg">
              <Video size={16} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-foreground">{totalDone}</p>
            <p className="text-xs text-muted-foreground">
              Videos produites
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="w-9 h-9 flex items-center justify-center bg-blue-500/10 rounded-lg">
              <CalendarDays size={16} className="text-blue-500" />
            </div>
            <p className="text-2xl font-black text-foreground">{thisMonth}</p>
            <p className="text-xs text-muted-foreground">
              Ce mois
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="w-9 h-9 flex items-center justify-center bg-yellow-500/10 rounded-lg">
              <Clock size={16} className="text-yellow-500" />
            </div>
            <p className="text-2xl font-black text-foreground">{submitted}</p>
            <p className="text-xs text-muted-foreground">
              En attente de montage
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="w-9 h-9 flex items-center justify-center bg-primary/10 rounded-lg">
              <FileText size={16} className="text-primary" />
            </div>
            <p className="text-2xl font-black text-foreground">{planned}</p>
            <p className="text-xs text-muted-foreground">
              Contenu planifie
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Format distribution */}
      {Object.keys(formatCounts).length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-medium text-muted-foreground">
            Repartition par format
          </h2>
          <Card>
            <CardContent className="p-6 space-y-4">
              {Object.entries(formatCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([format, count]) => {
                  const fmt = FORMAT_CONFIGS[format as ContentFormat]
                  const color = FORMAT_COLORS[format] ?? 'bg-zinc-500'
                  const pct = Math.round((count / maxFormatCount) * 100)
                  return (
                    <div key={format} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-foreground flex items-center gap-1.5">
                          {fmt && <span>{fmt.icon}</span>}
                          {fmt?.label ?? format}
                        </span>
                        <span className="text-xs text-muted-foreground font-bold">{count}</span>
                      </div>
                      <div className="h-2 bg-surface/50 rounded-full overflow-hidden border border-border/40">
                        <div
                          className={`h-full ${color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Recent activity */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium text-muted-foreground">
          Activite recente
        </h2>
        {recentSessions.length > 0 ? (
          <Card>
            <CardContent className="p-0 divide-y divide-border/40">
              {recentSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">
                      {new Date(s.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <p className="text-sm font-bold text-foreground">
                      {s.theme?.name ?? s.themeName ?? 'Session'}
                    </p>
                  </div>
                  <Badge variant={s.status === 'DONE' ? 'active' : s.status === 'SUBMITTED' ? 'default' : 'secondary'}>
                    {s.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-xs text-muted-foreground">Aucune activite recente.</p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
