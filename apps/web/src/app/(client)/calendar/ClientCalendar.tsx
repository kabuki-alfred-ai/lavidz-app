'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
  Video,
} from 'lucide-react'
import { FORMAT_CONFIGS, type ContentFormat, type ContentCalendarStatus } from '@lavidz/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface CalendarEntry {
  id: string
  scheduledDate: string
  topic: string
  description: string | null
  format: ContentFormat
  platforms: string[]
  status: ContentCalendarStatus
  sessionId: string | null
  aiSuggestions: { hook?: string; questions?: string[]; script?: string; angle?: string } | null
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  return `${start.toLocaleDateString('fr-FR', opts)} — ${end.toLocaleDateString('fr-FR', opts)}`
}

const STATUS_CONFIG: Record<ContentCalendarStatus, { label: string; className: string }> = {
  PLANNED: { label: 'Planifie', className: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-400' },
  RECORDED: { label: 'Enregistre', className: 'border-blue-500/40 bg-blue-500/10 text-blue-400' },
  EDITING: { label: 'Montage', className: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' },
  DELIVERED: { label: 'Livre', className: 'border-green-500/40 bg-green-500/10 text-green-400' },
  PUBLISHED: { label: 'Publie', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
  SKIPPED: { label: 'Ignore', className: 'border-zinc-600/40 bg-zinc-600/10 text-zinc-500' },
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ClientCalendar() {
  const router = useRouter()
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selected, setSelected] = useState<CalendarEntry | null>(null)

  /* Fetch */
  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/content-calendar', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setEntries(Array.isArray(data) ? data : data.data ?? [])
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  /* Week days */
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  const today = useMemo(() => new Date(), [])

  /* Navigation */
  const prevWeek = () => setWeekStart((s) => addDays(s, -7))
  const nextWeek = () => setWeekStart((s) => addDays(s, 7))
  const goToday = () => setWeekStart(startOfWeek(new Date()))

  /* Entries by day */
  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const day of days) {
      const key = day.toISOString().slice(0, 10)
      map.set(
        key,
        entries.filter((e) => isSameDay(new Date(e.scheduledDate), day)),
      )
    }
    return map
  }, [entries, days])

  /* Record availability */
  const canRecord = (entry: CalendarEntry) => {
    if (entry.status !== 'PLANNED') return false
    const scheduled = new Date(entry.scheduledDate)
    scheduled.setHours(0, 0, 0, 0)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return scheduled <= now
  }

  /* ---------------------------------------------------------------- */
  /* Empty state                                                       */
  /* ---------------------------------------------------------------- */

  if (!loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <MessageSquare size={20} className="text-primary" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Pas encore de calendrier. Discute avec l&apos;IA pour en generer un.
        </p>
        <Link href="/chat">
          <Button size="sm">Aller au chat IA</Button>
        </Link>
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">Calendrier</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevWeek} aria-label="Semaine precedente">
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Aujourd&apos;hui
          </Button>
          <Button variant="ghost" size="icon" onClick={nextWeek} aria-label="Semaine suivante">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        {formatWeekRange(weekStart)}
      </p>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-32 bg-surface-raised animate-pulse border border-border" />
          ))}
        </div>
      )}

      {/* Week grid */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {days.map((day) => {
            const key = day.toISOString().slice(0, 10)
            const dayEntries = entriesByDay.get(key) ?? []
            const isToday = isSameDay(day, today)

            return (
              <div
                key={key}
                className={`min-h-[120px] border p-2 space-y-1.5 ${
                  isToday
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-card'
                }`}
              >
                <p
                  className={`text-xs uppercase tracking-wider ${
                    isToday ? 'text-primary font-bold' : 'text-muted-foreground'
                  }`}
                >
                  {formatDayLabel(day)}
                </p>

                {dayEntries.map((entry) => {
                  const fmt = FORMAT_CONFIGS[entry.format]
                  const status = STATUS_CONFIG[entry.status]
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSelected(entry)}
                      className="w-full text-left p-1.5 rounded border border-border/50 bg-surface-raised hover:bg-muted/50 transition-colors space-y-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{fmt?.icon ?? '📋'}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {fmt?.label ?? entry.format}
                        </span>
                      </div>
                      <p className="text-xs text-foreground leading-tight line-clamp-2">
                        {entry.topic}
                      </p>
                      <Badge className={status.className}>{status.label}</Badge>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <Card
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">
                    {FORMAT_CONFIGS[selected.format]?.icon ?? '📋'}
                  </span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    {FORMAT_CONFIGS[selected.format]?.label ?? selected.format}
                  </span>
                  <Badge className={STATUS_CONFIG[selected.status].className}>
                    {STATUS_CONFIG[selected.status].label}
                  </Badge>
                </div>
                <h2 className="text-sm font-bold leading-snug">{selected.topic}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Date */}
              <p className="text-xs text-muted-foreground">
                {new Date(selected.scheduledDate).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>

              {/* Description */}
              {selected.description && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {selected.description}
                  </p>
                </div>
              )}

              {/* Hook */}
              {selected.aiSuggestions?.hook && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Hook suggere
                  </p>
                  <p className="text-sm text-foreground italic border-l-2 border-primary/40 pl-3">
                    &ldquo;{selected.aiSuggestions.hook}&rdquo;
                  </p>
                </div>
              )}

              {/* Platforms */}
              {selected.platforms.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Plateformes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.platforms.map((p) => (
                      <Badge key={p} variant="outline">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {canRecord(selected) && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setSelected(null)
                      router.push(`/chat?action=record&topic=${encodeURIComponent(selected.topic)}&format=${selected.format}`)
                    }}
                  >
                    <Video size={14} />
                    S&apos;enregistrer
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/chat')}
                >
                  <MessageSquare size={14} />
                  Modifier via l&apos;IA
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
