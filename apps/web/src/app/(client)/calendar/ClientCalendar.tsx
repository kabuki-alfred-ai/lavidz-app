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
  FileText,
  Loader2,
  CalendarDays,
} from 'lucide-react'
import { FORMAT_CONFIGS, type ContentFormat, type ContentCalendarStatus } from '@lavidz/types'
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
  topicId: string | null
  topicEntity: { id: string; status: 'DRAFT' | 'READY' | 'ARCHIVED' } | null
  aiSuggestions: { hook?: string; questions?: string[]; script?: string; angle?: string } | null
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  return `${start.toLocaleDateString('fr-FR', opts)} — ${end.toLocaleDateString('fr-FR', opts)}`
}

const TOPIC_INDICATOR: Record<string, { label: string; dot: string }> = {
  DRAFT: { label: 'En cours', dot: 'bg-amber-500' },
  READY: { label: 'Pret', dot: 'bg-emerald-500' },
  ARCHIVED: { label: 'Archive', dot: 'bg-muted-foreground/40' },
}

/* ------------------------------------------------------------------ */
/* Entry card (shared between mobile & desktop)                        */
/* ------------------------------------------------------------------ */

function EntryCard({ entry, onClick }: { entry: CalendarEntry; onClick: () => void }) {
  const fmt = FORMAT_CONFIGS[entry.format]
  const topicStatus = entry.topicEntity?.status
  const indicator = topicStatus ? TOPIC_INDICATOR[topicStatus] : null
  const noTopic = entry.status === 'PLANNED' && !entry.topicId

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-3 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm hover:shadow-md ${
        topicStatus === 'READY'
          ? 'bg-emerald-500/10 border-2 border-emerald-500/30'
          : topicStatus === 'DRAFT'
            ? 'bg-amber-500/10 border-2 border-amber-500/30'
            : 'bg-card border-2 border-border/50'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm shrink-0">{fmt?.icon ?? '📋'}</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate">{fmt?.label ?? entry.format}</span>
      </div>
      <p className="text-xs font-semibold text-foreground leading-relaxed">{entry.topic}</p>
      <div className="flex items-center gap-1.5 mt-2">
        {indicator && (
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${indicator.dot}`} />
            <span className="text-[10px] font-medium text-muted-foreground">{indicator.label}</span>
          </span>
        )}
        {noTopic && (
          <span className="text-[10px] font-medium text-muted-foreground/50">A preparer</span>
        )}
      </div>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Detail sheet                                                        */
/* ------------------------------------------------------------------ */

function EntryDetail({ entry, onClose }: { entry: CalendarEntry; onClose: () => void }) {
  const router = useRouter()
  const [creatingTopic, setCreatingTopic] = useState(false)
  const fmt = FORMAT_CONFIGS[entry.format]
  const topicStatus = entry.topicEntity?.status
  const indicator = topicStatus ? TOPIC_INDICATOR[topicStatus] : null

  const canRec = (() => {
    if (entry.status !== 'PLANNED') return false
    const scheduled = new Date(entry.scheduledDate)
    scheduled.setHours(0, 0, 0, 0)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return scheduled <= now
  })()

  async function handlePrepareTopic() {
    if (entry.topicId) { onClose(); router.push(`/topics/${entry.topicId}`); return }
    setCreatingTopic(true)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: entry.topic, brief: entry.description || entry.aiSuggestions?.hook || null, calendarEntryId: entry.id }),
      })
      if (res.ok) { const topic = await res.json(); entry.topicId = topic.id; onClose(); router.push(`/topics/${topic.id}`) }
    } catch { /* */ }
    finally { setCreatingTopic(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full md:max-w-lg bg-background rounded-t-2xl md:rounded-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-lg">{fmt?.icon ?? '📋'}</span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{fmt?.label ?? entry.format}</span>
                {indicator && (
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    topicStatus === 'READY' ? 'bg-emerald-500/10 text-emerald-600' : topicStatus === 'DRAFT' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${indicator.dot}`} />
                    {indicator.label}
                  </span>
                )}
                {entry.status === 'PLANNED' && !entry.topicId && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">A preparer</span>
                )}
              </div>
              <h2 className="text-base font-bold text-foreground leading-snug">{entry.topic}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(entry.scheduledDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Description */}
          {entry.description && (
            <div className="rounded-xl bg-muted/20 p-4">
              <p className="text-sm text-foreground/80 leading-relaxed">{entry.description}</p>
            </div>
          )}

          {/* Hook */}
          {entry.aiSuggestions?.hook && (
            <div className="rounded-xl bg-primary/5 p-4">
              <p className="text-[10px] uppercase tracking-wider text-primary/60 mb-1.5">Hook suggere</p>
              <p className="text-sm text-foreground italic leading-relaxed">&ldquo;{entry.aiSuggestions.hook}&rdquo;</p>
            </div>
          )}

          {/* Platforms */}
          {entry.platforms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {entry.platforms.map((p) => (
                <span key={p} className="text-xs px-2.5 py-1 rounded-full bg-muted/30 text-muted-foreground">{p}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2">
            <button
              onClick={handlePrepareTopic}
              disabled={creatingTopic}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creatingTopic ? <Loader2 size={14} className="animate-spin" /> : entry.topicId ? <FileText size={14} /> : <FileText size={14} />}
              {entry.topicId ? 'Voir le sujet' : 'Preparer ce sujet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function ClientCalendar() {
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selected, setSelected] = useState<CalendarEntry | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/content-calendar', { credentials: 'include' })
      if (res.ok) { const data = await res.json(); setEntries(Array.isArray(data) ? data : data.data ?? []) }
    } catch { /* */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const today = useMemo(() => new Date(), [])

  const prevWeek = () => setWeekStart((s) => addDays(s, -7))
  const nextWeek = () => setWeekStart((s) => addDays(s, 7))
  const goToday = () => setWeekStart(startOfWeek(new Date()))

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const day of days) {
      const key = day.toISOString().slice(0, 10)
      map.set(key, entries.filter((e) => isSameDay(new Date(e.scheduledDate), day)))
    }
    return map
  }, [entries, days])

  /* Empty state */
  if (!loading && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center">
          <CalendarDays size={24} className="text-primary/40" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Pas encore de calendrier</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">Discute avec Kabou pour generer ton calendrier editorial.</p>
        </div>
        <Link href="/chat">
          <Button className="gap-2"><MessageSquare size={14} /> Discuter avec Kabou</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Calendrier</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{formatWeekRange(weekStart)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevWeek} className="w-9 h-9 rounded-xl hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button onClick={goToday} className="px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            Aujourd&apos;hui
          </button>
          <button onClick={nextWeek} className="w-9 h-9 rounded-xl hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-xl" />
          ))}
        </div>
      )}

      {/* ── Desktop: week grid ── */}
      {!loading && (
        <div className="hidden md:grid grid-cols-7 gap-3">
          {days.map((day) => {
            const key = day.toISOString().slice(0, 10)
            const dayEntries = entriesByDay.get(key) ?? []
            const isToday = isSameDay(day, today)
            const isPast = day < today && !isToday

            return (
              <div
                key={key}
                className={`min-h-[160px] rounded-xl p-3 space-y-2.5 transition-colors ${
                  isToday
                    ? 'bg-primary/5 ring-1 ring-primary/20'
                    : isPast
                      ? 'bg-muted/10'
                      : 'bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium uppercase tracking-wider ${isToday ? 'text-primary' : isPast ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
                    {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </span>
                  <span className={`text-sm font-bold ${isToday ? 'text-primary' : isPast ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                    {day.getDate()}
                  </span>
                  {isToday && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                </div>
                <div className="space-y-1.5">
                  {dayEntries.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} onClick={() => setSelected(entry)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Mobile: day list ── */}
      {!loading && (
        <div className="md:hidden space-y-4">
          {days.map((day) => {
            const key = day.toISOString().slice(0, 10)
            const dayEntries = entriesByDay.get(key) ?? []
            const isToday = isSameDay(day, today)
            if (dayEntries.length === 0 && !isToday) return null

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  {isToday && <span className="w-2 h-2 rounded-full bg-primary" />}
                  <p className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {isToday ? "Aujourd'hui" : day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
                {dayEntries.length === 0 && isToday && (
                  <div className="rounded-xl bg-muted/10 p-4 text-center">
                    <p className="text-xs text-muted-foreground/50">Rien de prevu aujourd&apos;hui</p>
                  </div>
                )}
                <div className="space-y-2">
                  {dayEntries.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} onClick={() => setSelected(entry)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail sheet */}
      {selected && <EntryDetail entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
