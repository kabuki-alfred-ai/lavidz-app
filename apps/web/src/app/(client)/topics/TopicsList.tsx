'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  FileText,
  Plus,
  ArrowRight,
  CalendarDays,
  Film,
} from 'lucide-react'
import { deriveCreativeState, type CreativeState } from '@/lib/creative-state'
import { isRecordingGuide } from '@/lib/recording-guide'
import { isNarrativeAnchor } from '@/lib/narrative-anchor'
import { getCreativeStageVisual } from '@/components/subject/CreativeStageIcons'

interface TopicEntry {
  id: string
  name: string
  brief: string | null
  status: 'DRAFT' | 'READY' | 'ARCHIVED'
  pillar: string | null
  recordingGuide: unknown
  narrativeAnchor: unknown
  calendarEntries: { id: string; scheduledDate: string; format: string; status: string }[]
  sessions: { id: string; status: string }[]
  updatedAt: string
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

type StageFilter = 'all' | 'growing' | 'ready' | 'archived'

// Enrichit chaque topic avec son creativeState dérivé côté front.
type EnrichedTopic = TopicEntry & { creativeState: CreativeState }

function enrichTopic(topic: TopicEntry): EnrichedTopic {
  const guide = isRecordingGuide(topic.recordingGuide) ? topic.recordingGuide : null
  const anchor = isNarrativeAnchor(topic.narrativeAnchor) ? topic.narrativeAnchor : null
  return {
    ...topic,
    creativeState: deriveCreativeState({
      topicStatus: topic.status,
      brief: topic.brief,
      narrativeAnchor: anchor,
      recordingGuide: guide,
    }),
  }
}

// Mappe un filtre UX → ensemble de creativeState. Avec les 4 états stratégiques,
// les anciens filtres "ready" (MATURE + SCHEDULED) et "producing" deviennent
// respectivement juste "MATURE" et "archived" (le bouillon tactique des sessions
// n'étant plus projeté sur le Topic).
function matchesFilter(state: CreativeState, filter: StageFilter): boolean {
  switch (filter) {
    case 'all': return true
    case 'growing': return state === 'SEED' || state === 'EXPLORING'
    case 'ready': return state === 'MATURE'
    case 'archived': return state === 'ARCHIVED'
  }
}

export function TopicsList() {
  const [topics, setTopics] = useState<TopicEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StageFilter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/topics', { credentials: 'include' })
      if (res.ok) setTopics(await res.json())
    } catch { /* */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const enriched = useMemo(() => topics.map(enrichTopic), [topics])
  const filtered = enriched.filter((t) => matchesFilter(t.creativeState, filter))

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
          href="/chat?new=1"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Nouveau
        </Link>
      </div>

      {/* Filters — regroupent les creativeStates par phase de maturation */}
      <div className="flex gap-1 p-1 bg-surface rounded-xl w-fit flex-wrap">
        {([
          ['all', 'Tous'],
          ['growing', 'En germination'],
          ['ready', 'Prêts'],
          ['archived', 'Archivés'],
        ] as const).map(([key, label]) => (
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
            const stage = getCreativeStageVisual(topic.creativeState)
            const isArchived = topic.creativeState === 'ARCHIVED'
            return (
              <Link
                key={topic.id}
                href={`/sujets/${topic.id}`}
                className={`group flex items-start gap-4 rounded-xl bg-muted/10 p-4 transition-colors hover:bg-muted/25 ${
                  isArchived ? 'opacity-70' : ''
                }`}
              >
                {/* Statut du sujet — même style que le stade actif de la
                   timeline sur la page détail : cercle avec ring, illustration,
                   label + hint en dessous. */}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full border ${stage.bgClass} ${stage.borderClass} ${
                      !isArchived ? 'shadow-sm ring-2 ring-primary/10' : ''
                    }`}
                  >
                    <stage.Icon className={`h-9 w-9 ${stage.textColor}`} active={!isArchived} />
                  </div>
                  <div className="text-center">
                    <p className={`text-[11px] font-semibold leading-tight ${stage.textColor}`}>{stage.label}</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{stage.hint}</p>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{topic.name}</p>
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
                            : `${topic.calendarEntries.length} planifié${topic.calendarEntries.length > 1 ? 's' : ''}`
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
