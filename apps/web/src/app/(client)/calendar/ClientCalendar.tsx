'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  X,
  MessageSquare,
  Play,
  Sparkles,
  FileText,
  Loader2,
  CalendarDays,
  Mic,
  Film,
  Cog,
} from 'lucide-react'
import { FORMAT_CONFIGS, type ContentFormat, type ContentCalendarStatus } from '@lavidz/types'
import { Button } from '@/components/ui/button'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type SessionStatus =
  | 'PENDING'
  | 'RECORDING'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'DONE'
  | 'FAILED'

type TopicStatus = 'DRAFT' | 'READY' | 'ARCHIVED'

interface SessionRef {
  id: string
  status: SessionStatus
  submittedAt: string | null
}

interface TopicRef {
  id: string
  status: TopicStatus
  brief: string | null
  pillar: string | null
  sessions: SessionRef[]
}

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
  topicEntity: TopicRef | null
  aiSuggestions: { hook?: string; questions?: string[]; script?: string; angle?: string } | null
  createdAt: string
}

type ActionKind =
  | { kind: 'prepare' }
  | { kind: 'open_subject'; topicId: string }
  | { kind: 'record'; sessionId: string; topicId: string }
  | { kind: 'processing'; sessionId: string; topicId: string }
  | { kind: 'publish'; sessionId: string; topicId: string }

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

/**
 * Given a calendar entry, decide which single action is the most useful right
 * now. The whole flow is designed so the entrepreneur never has to think — the
 * calendar always points to the next concrete step.
 */
function resolveAction(entry: CalendarEntry): ActionKind {
  const topic = entry.topicEntity
  if (!topic) return { kind: 'prepare' }

  const latestSession = topic.sessions[0]
  if (!latestSession) {
    return { kind: 'open_subject', topicId: topic.id }
  }

  switch (latestSession.status) {
    case 'PENDING':
    case 'RECORDING':
      return { kind: 'record', sessionId: latestSession.id, topicId: topic.id }
    case 'SUBMITTED':
    case 'PROCESSING':
      return { kind: 'processing', sessionId: latestSession.id, topicId: topic.id }
    case 'DONE':
      return { kind: 'publish', sessionId: latestSession.id, topicId: topic.id }
    case 'FAILED':
    default:
      return { kind: 'open_subject', topicId: topic.id }
  }
}

const ACTION_META: Record<
  ActionKind['kind'],
  { label: string; Icon: typeof Play; tone: string }
> = {
  prepare: {
    label: 'Préparer',
    Icon: Sparkles,
    tone: 'bg-muted/40 text-muted-foreground hover:bg-muted/60',
  },
  open_subject: {
    label: 'Ouvrir',
    Icon: FileText,
    tone: 'bg-primary/10 text-primary hover:bg-primary/15',
  },
  record: {
    label: 'Enregistrer',
    Icon: Mic,
    tone: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
  processing: {
    label: 'En traitement',
    Icon: Cog,
    tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 cursor-wait',
  },
  publish: {
    label: 'Publier',
    Icon: Film,
    tone: 'bg-emerald-500 text-white hover:bg-emerald-600',
  },
}

/* ------------------------------------------------------------------ */
/* Entry card                                                          */
/* ------------------------------------------------------------------ */

function EntryCard({
  entry,
  onClick,
  onAction,
  actionPending,
}: {
  entry: CalendarEntry
  onClick: () => void
  onAction: (entry: CalendarEntry) => void
  actionPending: boolean
}) {
  const fmt = FORMAT_CONFIGS[entry.format]
  const action = resolveAction(entry)
  const meta = ACTION_META[action.kind]
  const Icon = meta.Icon

  const topicStatus = entry.topicEntity?.status
  const topicHalo =
    topicStatus === 'READY'
      ? 'border-emerald-500/30'
      : topicStatus === 'DRAFT'
        ? 'border-amber-500/30'
        : 'border-border/50'

  return (
    <div
      className={`group w-full rounded-xl border-2 ${topicHalo} bg-card p-3 text-left transition-all hover:shadow-md`}
    >
      <button
        type="button"
        onClick={onClick}
        className="mb-2 flex w-full items-center gap-1.5 text-left"
      >
        <span className="shrink-0 text-sm">{fmt?.icon ?? '📋'}</span>
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {fmt?.label ?? entry.format}
        </span>
      </button>
      <p
        className="mb-2 line-clamp-2 cursor-pointer text-xs font-semibold leading-relaxed text-foreground"
        onClick={onClick}
      >
        {entry.topic}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onAction(entry)
        }}
        disabled={actionPending || action.kind === 'processing'}
        className={`inline-flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-60 ${meta.tone}`}
      >
        {actionPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Icon className="h-3 w-3" />
        )}
        {meta.label}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Detail sheet                                                        */
/* ------------------------------------------------------------------ */

function EntryDetail({
  entry,
  onClose,
  onAction,
  actionPending,
}: {
  entry: CalendarEntry
  onClose: () => void
  onAction: (entry: CalendarEntry) => void
  actionPending: boolean
}) {
  const fmt = FORMAT_CONFIGS[entry.format]
  const action = resolveAction(entry)
  const meta = ACTION_META[action.kind]
  const Icon = meta.Icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-background duration-200 animate-in slide-in-from-bottom-4 md:max-w-lg md:rounded-2xl md:slide-in-from-bottom-0 md:fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-1 pt-3 md:hidden">
          <div className="h-1 w-8 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="px-5 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-lg">{fmt?.icon ?? '📋'}</span>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {fmt?.label ?? entry.format}
                </span>
                {entry.topicEntity?.pillar && (
                  <span className="rounded-full bg-surface-raised/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {entry.topicEntity.pillar}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold leading-snug text-foreground">{entry.topic}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(entry.scheduledDate).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="-mr-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 pb-6">
          {(entry.topicEntity?.brief || entry.description) && (
            <div className="rounded-xl bg-muted/20 p-4">
              <p className="text-sm leading-relaxed text-foreground/80">
                {entry.topicEntity?.brief ?? entry.description}
              </p>
            </div>
          )}

          {entry.aiSuggestions?.hook && (
            <div className="rounded-xl bg-primary/5 p-4">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-primary/60">
                Hook suggéré
              </p>
              <p className="text-sm italic leading-relaxed text-foreground">
                &ldquo;{entry.aiSuggestions.hook}&rdquo;
              </p>
            </div>
          )}

          {entry.platforms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {entry.platforms.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => onAction(entry)}
            disabled={actionPending || action.kind === 'processing'}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-60 ${meta.tone}`}
          >
            {actionPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
            {meta.label}
            {action.kind === 'record' && <span className="text-xs opacity-80">le tournage</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function ClientCalendar() {
  const router = useRouter()
  const [entries, setEntries] = useState<CalendarEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [selected, setSelected] = useState<CalendarEntry | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/content-calendar', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setEntries(Array.isArray(data) ? data : data.data ?? [])
      }
    } catch {
      /* swallow */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleAction = useCallback(
    async (entry: CalendarEntry) => {
      const action = resolveAction(entry)
      if (action.kind === 'processing') return

      if (action.kind === 'open_subject') {
        setSelected(null)
        router.push(`/sujets/${action.topicId}`)
        return
      }

      if (action.kind === 'record') {
        setSelected(null)
        router.push(`/s/${action.sessionId}`)
        return
      }

      if (action.kind === 'publish') {
        setSelected(null)
        router.push(`/sujets/${action.sessionId}/publier`)
        return
      }

      if (action.kind === 'prepare') {
        setPendingActionId(entry.id)
        try {
          const res = await fetch('/api/topics', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: entry.topic,
              brief: entry.description || entry.aiSuggestions?.hook || entry.aiSuggestions?.angle || null,
              calendarEntryId: entry.id,
            }),
          })
          if (res.ok) {
            const topic = (await res.json()) as { id: string }
            setSelected(null)
            router.push(`/sujets/${topic.id}`)
          }
        } finally {
          setPendingActionId(null)
        }
      }
    },
    [router],
  )

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const today = useMemo(() => new Date(), [])

  const prevWeek = () => setWeekStart((s) => addDays(s, -7))
  const nextWeek = () => setWeekStart((s) => addDays(s, 7))
  const goToday = () => setWeekStart(startOfWeek(new Date()))

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

  if (!loading && entries.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/5">
          <CalendarDays size={24} className="text-primary/40" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Pas encore de calendrier</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Discute avec Kabou pour générer ton calendrier éditorial.
          </p>
        </div>
        <Link href="/chat">
          <Button className="gap-2">
            <MessageSquare size={14} /> Discuter avec Kabou
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Calendrier</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{formatWeekRange(weekStart)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToday}
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            Aujourd&apos;hui
          </button>
          <button
            onClick={nextWeek}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/20" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="hidden gap-3 md:grid md:grid-cols-7">
          {days.map((day) => {
            const key = day.toISOString().slice(0, 10)
            const dayEntries = entriesByDay.get(key) ?? []
            const isToday = isSameDay(day, today)
            const isPast = day < today && !isToday

            return (
              <div
                key={key}
                className={`min-h-[180px] space-y-2.5 rounded-xl p-3 transition-colors ${
                  isToday
                    ? 'bg-primary/5 ring-1 ring-primary/20'
                    : isPast
                      ? 'bg-muted/10'
                      : 'bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium uppercase tracking-wider ${
                      isToday
                        ? 'text-primary'
                        : isPast
                          ? 'text-muted-foreground/40'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      isToday
                        ? 'text-primary'
                        : isPast
                          ? 'text-muted-foreground/40'
                          : 'text-foreground'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {isToday && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
                </div>
                <div className="space-y-1.5">
                  {dayEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      onClick={() => setSelected(entry)}
                      onAction={handleAction}
                      actionPending={pendingActionId === entry.id}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && (
        <div className="space-y-4 md:hidden">
          {days.map((day) => {
            const key = day.toISOString().slice(0, 10)
            const dayEntries = entriesByDay.get(key) ?? []
            const isToday = isSameDay(day, today)
            if (dayEntries.length === 0 && !isToday) return null

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  {isToday && <span className="h-2 w-2 rounded-full bg-primary" />}
                  <p
                    className={`text-sm font-semibold ${
                      isToday ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {isToday
                      ? "Aujourd'hui"
                      : day.toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                  </p>
                </div>
                {dayEntries.length === 0 && isToday && (
                  <div className="rounded-xl bg-muted/10 p-4 text-center">
                    <p className="text-xs text-muted-foreground/50">Rien de prévu aujourd&apos;hui</p>
                  </div>
                )}
                <div className="space-y-2">
                  {dayEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      onClick={() => setSelected(entry)}
                      onAction={handleAction}
                      actionPending={pendingActionId === entry.id}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <EntryDetail
          entry={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
          actionPending={pendingActionId === selected.id}
        />
      )}
    </div>
  )
}
