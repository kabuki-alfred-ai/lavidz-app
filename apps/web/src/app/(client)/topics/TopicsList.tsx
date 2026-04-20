'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  FileText,
  Loader2,
  Plus,
  ArrowRight,
  CalendarDays,
  Film,
  Archive,
} from 'lucide-react'

interface TopicEntry {
  id: string
  name: string
  brief: string | null
  status: 'DRAFT' | 'READY' | 'ARCHIVED'
  pillar: string | null
  calendarEntries: { id: string; scheduledDate: string; format: string; status: string }[]
  sessions: { id: string; status: string }[]
  updatedAt: string
}

const STATUS_STYLE: Record<string, { label: string; class: string }> = {
  DRAFT: { label: 'Brouillon', class: 'bg-amber-500/10 text-amber-600' },
  READY: { label: 'Pret', class: 'bg-emerald-500/10 text-emerald-600' },
  ARCHIVED: { label: 'Archive', class: 'bg-muted text-muted-foreground' },
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "a l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `il y a ${d}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function TopicsList() {
  const [topics, setTopics] = useState<TopicEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'DRAFT' | 'READY' | 'ARCHIVED'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/topics', { credentials: 'include' })
      if (res.ok) setTopics(await res.json())
    } catch { /* */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? topics : topics.filter((t) => t.status === filter)

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4">
        <div className="h-8 w-40 bg-muted animate-pulse rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Mes sujets</h1>
          <p className="text-sm text-muted-foreground mt-1">{topics.length} sujet{topics.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Nouveau
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl w-fit">
        {([['all', 'Tous'], ['DRAFT', 'Brouillons'], ['READY', 'Prets'], ['ARCHIVED', 'Archives']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              filter === key ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-muted/20 p-12 text-center space-y-3">
          <FileText size={28} className="text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {filter === 'all' ? "Aucun sujet pour l'instant. Discute avec Kabou pour en creer un !" : 'Aucun sujet dans cette categorie.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((topic) => {
            const style = STATUS_STYLE[topic.status]
            return (
              <Link
                key={topic.id}
                href={`/sujets/${topic.id}`}
                className="flex items-start gap-4 p-4 rounded-xl bg-muted/10 hover:bg-muted/25 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/10 transition-colors">
                  {topic.status === 'ARCHIVED' ? (
                    <Archive size={16} className="text-muted-foreground/50" />
                  ) : (
                    <FileText size={16} className="text-primary/70" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{topic.name}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${style.class}`}>{style.label}</span>
                  </div>
                  {topic.brief && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{topic.brief}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60 flex-wrap">
                    {topic.pillar && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/5 text-primary/70">{topic.pillar}</span>
                    )}
                    {topic.calendarEntries.length > 0 && (() => {
                      const next = topic.calendarEntries
                        .filter((e) => e.status === 'PLANNED')
                        .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())[0]
                      return (
                        <span className="flex items-center gap-1">
                          <CalendarDays size={10} />
                          {next
                            ? new Date(next.scheduledDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                            : `${topic.calendarEntries.length} planifie${topic.calendarEntries.length > 1 ? 's' : ''}`
                          }
                        </span>
                      )
                    })()}
                    {topic.sessions.length > 0 && (
                      <span className="flex items-center gap-1"><Film size={10} /> {topic.sessions.length} session{topic.sessions.length > 1 ? 's' : ''}</span>
                    )}
                    <span>{formatRelative(topic.updatedAt)}</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0 mt-3" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
