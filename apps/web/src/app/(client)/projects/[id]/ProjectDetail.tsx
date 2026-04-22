'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, X, GripVertical, Search, Film,
  Check, ChevronDown, ChevronRight, Play, Pause, Clapperboard, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FORMAT_CONFIGS, type ContentFormat } from '@lavidz/types'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Rush {
  id: string
  rawVideoKey: string | null
  transcript: string | null
  status: string
  createdAt: string
  /** F10 — posé quand un retake canonique sur la même (sessionId, questionId) arrive. */
  supersededAt?: string | null
  /** Story 10 — recommandation Kabou posée par `take-analysis.service`. */
  kabouRecommendation?: {
    score: number
    reason: string
    criteria?: { tempo: number; clarity: number; energy: number; tone: number }
  } | null
  question: { id: string; text: string } | null
  session: {
    id: string
    createdAt: string
    contentFormat: ContentFormat | null
    theme: { id: string; name: string } | null
  }
}

interface ProjectClip {
  id: string
  order: number
  recording: Rush
}

interface Project {
  id: string
  title: string
  status: string
  clips: ProjectClip[]
}

/* ------------------------------------------------------------------ */
/* Video preview player                                                */
/* ------------------------------------------------------------------ */

function RushPreview({ recordingId, sessionId }: { recordingId: string; sessionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const src = `/api/video/${recordingId}?sessionId=${sessionId}`

  function togglePlay() {
    const el = videoRef.current
    if (!el) return
    if (el.paused) { el.play(); setPlaying(true) }
    else { el.pause(); setPlaying(false) }
  }

  return (
    <div className="relative group rounded-lg overflow-hidden bg-black/90 aspect-video mt-2">
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        className="w-full h-full object-contain"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      <button
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          {playing
            ? <Pause size={16} className="text-black" />
            : <Play size={16} className="text-black ml-0.5" />
          }
        </div>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Rush card (library)                                                  */
/* ------------------------------------------------------------------ */

function RushCard({
  rush,
  isAdded,
  onAdd,
  variant = 'canonical',
}: {
  rush: Rush
  isAdded: boolean
  onAdd: () => void
  /** canonical = carte principale (candidat par défaut au montage). superseded = accordion variantes. */
  variant?: 'canonical' | 'superseded'
}) {
  const [showPreview, setShowPreview] = useState(false)
  const fmt = rush.session.contentFormat ? FORMAT_CONFIGS[rush.session.contentFormat] : null
  const preview = rush.transcript?.slice(0, 120) ?? rush.question?.text ?? 'Pas de transcription'
  const hasVideo = !!rush.rawVideoKey
  const isSuperseded = variant === 'superseded'
  const hasRecommendation = !!rush.kabouRecommendation

  return (
    <div className={`rounded-xl border-2 p-3 transition-all ${
      isAdded
        ? 'border-primary/30 bg-primary/5'
        : isSuperseded
          ? 'border-border/30 bg-muted/5 opacity-80'
          : 'border-border/50 bg-card hover:border-primary/20'
    }`}>
      <div className="flex items-start gap-3">
        {/* Play thumbnail button */}
        {hasVideo && (
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="shrink-0 w-16 h-10 rounded-lg bg-black/80 flex items-center justify-center hover:bg-black/60 transition-colors relative overflow-hidden"
          >
            {showPreview
              ? <Pause size={14} className="text-white" />
              : <Play size={14} className="text-white ml-0.5" />
            }
          </button>
        )}

        <div className="flex-1 min-w-0">
          {/* Format badge + theme + ⭐ (Story 10) */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {fmt && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                <span>{fmt.icon}</span>
                <span>{fmt.label}</span>
              </span>
            )}
            {rush.session.theme && (
              <span className="text-[10px] text-muted-foreground/60 truncate">
                {rush.session.theme.name}
              </span>
            )}
            {hasRecommendation && !isSuperseded && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                title={rush.kabouRecommendation?.reason ?? 'Prise recommandée par Kabou'}
              >
                <Star size={9} className="fill-current" />
                Kabou
              </span>
            )}
            {isSuperseded && (
              <span className="text-[10px] italic text-muted-foreground/60">Variante</span>
            )}
          </div>

          {/* Question */}
          {rush.question && (
            <p className="text-xs font-semibold text-foreground mb-1 leading-relaxed line-clamp-1">
              {rush.question.text}
            </p>
          )}
          {/* Reason de la reco Kabou — seulement sur canonical pour éviter bruit */}
          {hasRecommendation && !isSuperseded && rush.kabouRecommendation?.reason && (
            <p className="mb-1 text-[11px] italic text-amber-700/80 dark:text-amber-300/80 line-clamp-2">
              {rush.kabouRecommendation.reason}
            </p>
          )}

          {/* Transcript preview */}
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
            {preview}
          </p>

          <p className="text-[10px] text-muted-foreground/40 mt-1.5">
            {new Date(rush.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <button
          onClick={onAdd}
          disabled={isAdded}
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            isAdded
              ? 'bg-primary/10 text-primary cursor-default'
              : 'bg-muted/30 text-muted-foreground hover:bg-primary hover:text-primary-foreground'
          }`}
        >
          {isAdded ? <Check size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {/* Video preview */}
      {showPreview && hasVideo && (
        <RushPreview recordingId={rush.id} sessionId={rush.session.id} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Timeline clip (project)                                             */
/* ------------------------------------------------------------------ */

function TimelineClip({
  clip,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  clip: ProjectClip
  onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}) {
  const [showPreview, setShowPreview] = useState(false)
  const fmt = clip.recording.session.contentFormat ? FORMAT_CONFIGS[clip.recording.session.contentFormat] : null
  const hasVideo = !!clip.recording.rawVideoKey

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="rounded-xl border-2 border-border/50 bg-card p-3 hover:border-primary/20 transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <GripVertical size={14} className="text-muted-foreground/30 shrink-0" />

        <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {clip.order + 1}
        </div>

        {/* Play button */}
        {hasVideo && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowPreview(!showPreview) }}
            className="shrink-0 w-8 h-8 rounded-lg bg-black/80 flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            {showPreview
              ? <Pause size={10} className="text-white" />
              : <Play size={10} className="text-white ml-0.5" />
            }
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {fmt && <span className="text-xs">{fmt.icon}</span>}
            <span className="text-xs font-semibold text-foreground truncate">
              {clip.recording.question?.text ?? 'Rush'}
            </span>
          </div>
          {clip.recording.session.theme && (
            <p className="text-[10px] text-muted-foreground/60 truncate">{clip.recording.session.theme.name}</p>
          )}
        </div>

        <button
          onClick={onRemove}
          className="shrink-0 p-1.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Video preview */}
      {showPreview && hasVideo && (
        <RushPreview recordingId={clip.recording.id} sessionId={clip.recording.session.id} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [rushes, setRushes] = useState<Rush[]>([])
  const [loading, setLoading] = useState(true)
  const [rushesLoading, setRushesLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)

  // Filters
  const [formatFilter, setFormatFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch('/api/projects', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const found = (Array.isArray(data) ? data : []).find((p: Project) => p.id === projectId)
        if (found) setProject(found)
      }
    } catch { /* */ }
    finally { setLoading(false) }
  }, [projectId])

  const fetchRushes = useCallback(async () => {
    setRushesLoading(true)
    try {
      const params = new URLSearchParams()
      if (formatFilter) params.set('format', formatFilter)
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`/api/projects/rushes?${params}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setRushes(Array.isArray(data) ? data : [])
      }
    } catch { /* */ }
    finally { setRushesLoading(false) }
  }, [formatFilter, searchQuery])

  useEffect(() => { fetchProject() }, [fetchProject])
  useEffect(() => { fetchRushes() }, [fetchRushes])

  const addedIds = useMemo(
    () => new Set(project?.clips.map((c) => c.recording.id) ?? []),
    [project],
  )

  async function handleAddRush(recordingId: string) {
    setAdding(recordingId)
    try {
      const res = await fetch('/api/projects/clips', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, recordingId }),
      })
      if (res.ok) await fetchProject()
    } catch { /* */ }
    finally { setAdding(null) }
  }

  async function handleAddManyRushes(recordingIds: string[]) {
    for (const id of recordingIds) {
      try {
        await fetch('/api/projects/clips', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, recordingId: id }),
        })
      } catch { /* */ }
    }
    await fetchProject()
  }

  async function handleRemoveClip(clipId: string) {
    try {
      await fetch('/api/projects/clips', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, clipId }),
      })
      await fetchProject()
    } catch { /* */ }
  }

  async function handleReorder(fromIdx: number, toIdx: number) {
    if (!project || fromIdx === toIdx) return
    const clips = [...project.clips].sort((a, b) => a.order - b.order)
    const [moved] = clips.splice(fromIdx, 1)
    clips.splice(toIdx, 0, moved)
    const reordered = clips.map((c, i) => ({ ...c, order: i }))
    setProject({ ...project, clips: reordered })

    try {
      await fetch('/api/projects/clips', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, clipIds: reordered.map((c) => c.id) }),
      })
    } catch { await fetchProject() }
  }

  async function handleTitleSave() {
    if (!titleDraft.trim() || !project) return
    setEditingTitle(false)
    setProject({ ...project, title: titleDraft.trim() })
    try {
      await fetch('/api/projects', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, title: titleDraft.trim() }),
      })
    } catch { /* */ }
  }

  // Available formats for filter dropdown
  const availableFormats = useMemo(() => {
    const fmts = new Set(rushes.map((r) => r.session.contentFormat).filter(Boolean))
    return [...fmts] as ContentFormat[]
  }, [rushes])

  // Group rushes by session, ordered by most recent session first
  const groupedRushes = useMemo(() => {
    const map = new Map<string, { session: Rush['session']; rushes: Rush[] }>()
    for (const r of rushes) {
      const entry = map.get(r.session.id)
      if (entry) entry.rushes.push(r)
      else map.set(r.session.id, { session: r.session, rushes: [r] })
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.session.createdAt).getTime() - new Date(a.session.createdAt).getTime(),
    )
  }, [rushes])

  // Expanded-session state (defaults to all expanded)
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set())
  const toggleSession = (sid: string) => {
    setCollapsedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  // Story 9 — variants accordion par questionId (superseded collapsed).
  const [expandedQuestionVariants, setExpandedQuestionVariants] = useState<Set<string>>(new Set())
  const toggleQuestionVariants = (qKey: string) => {
    setExpandedQuestionVariants(prev => {
      const next = new Set(prev)
      if (next.has(qKey)) next.delete(qKey)
      else next.add(qKey)
      return next
    })
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-muted animate-pulse" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-6 w-56 bg-muted animate-pulse rounded-lg" />
            <div className="h-3.5 w-32 bg-muted animate-pulse rounded-md" />
          </div>
          <div className="h-9 w-28 bg-muted animate-pulse rounded-lg" />
        </div>

        {/* Two-column skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Timeline skeleton */}
          <div className="space-y-3">
            <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          </div>

          {/* RIGHT: Library skeleton */}
          <div className="space-y-3">
            <div className="h-4 w-40 bg-muted animate-pulse rounded-md" />
            <div className="flex items-center gap-2">
              <div className="h-9 flex-1 bg-muted animate-pulse rounded-xl" />
              <div className="h-9 w-36 bg-muted animate-pulse rounded-xl" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <p className="text-muted-foreground">Projet introuvable</p>
        <Button onClick={() => router.push('/projects')} variant="outline" size="sm">
          <ArrowLeft size={14} className="mr-2" /> Retour
        </Button>
      </div>
    )
  }

  const sortedClips = [...project.clips].sort((a, b) => a.order - b.order)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/projects')}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
              className="text-xl font-bold tracking-tight text-foreground bg-transparent border-b-2 border-primary outline-none w-full"
            />
          ) : (
            <h1
              onClick={() => { setEditingTitle(true); setTitleDraft(project.title) }}
              className="text-xl font-bold tracking-tight text-foreground cursor-text hover:text-primary transition-colors"
            >
              {project.title}
            </h1>
          )}
          <p className="text-sm text-muted-foreground mt-0.5">
            {sortedClips.length} rush{sortedClips.length > 1 ? 'es' : ''} dans le projet
          </p>
        </div>

        {sortedClips.length > 0 && (
          <Button
            onClick={() => router.push(`/process/project/${projectId}`)}
            className="gap-2 shrink-0"
          >
            <Clapperboard size={16} />
            Monter
          </Button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Project timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Timeline</h2>
          </div>

          {sortedClips.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border/50 p-8 text-center">
              <Film size={24} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                Ajoute des rushes depuis la bibliotheque
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedClips.map((clip, idx) => (
                <TimelineClip
                  key={clip.id}
                  clip={clip}
                  onRemove={() => handleRemoveClip(clip.id)}
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx !== null) handleReorder(dragIdx, idx)
                    setDragIdx(null)
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Rush library */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Bibliotheque de rushes</h2>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-muted/20 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div className="relative">
              <select
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-xl bg-muted/20 border border-border/50 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer"
              >
                <option value="">Tous les formats</option>
                {availableFormats.map((f) => (
                  <option key={f} value={f}>{FORMAT_CONFIGS[f]?.icon} {FORMAT_CONFIGS[f]?.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
            </div>
          </div>

          {/* Rush list */}
          {rushesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted/20 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : rushes.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border/50 p-8 text-center">
              <Film size={24} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucun rush disponible. Enregistre des sessions pour alimenter ta bibliotheque.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto custom-scrollbar pr-1">
              {groupedRushes.map(({ session, rushes: sessionRushes }) => {
                const collapsed = collapsedSessions.has(session.id)
                const fmt = session.contentFormat ? FORMAT_CONFIGS[session.contentFormat] : null
                const notAddedInSession = sessionRushes.filter(r => !addedIds.has(r.id))
                const allAdded = notAddedInSession.length === 0
                return (
                  <div key={session.id} className="rounded-xl border border-border/50 bg-muted/10 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                      <button
                        onClick={() => toggleSession(session.id)}
                        className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
                      >
                        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {fmt && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                              <span>{fmt.icon}</span>
                              <span>{fmt.label}</span>
                            </span>
                          )}
                          {session.theme && (
                            <span className="text-xs font-semibold text-foreground truncate">
                              {session.theme.name}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/60">
                            {new Date(session.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {sessionRushes.length} rush{sessionRushes.length > 1 ? 'es' : ''} · {sessionRushes.length - notAddedInSession.length} ajouté{sessionRushes.length - notAddedInSession.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => !allAdded && handleAddManyRushes(notAddedInSession.map(r => r.id))}
                        disabled={allAdded}
                        className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                          allAdded
                            ? 'text-muted-foreground/40 cursor-default'
                            : 'text-primary hover:bg-primary/10'
                        }`}
                      >
                        {allAdded ? 'Tous ajoutés' : 'Tout ajouter'}
                      </button>
                    </div>
                    {!collapsed && (
                      <div className="p-2 space-y-2">
                        {/* Story 9 — sub-grouping par questionId avec canonical
                           en haut + accordion "Prises précédentes" (superseded). */}
                        {(() => {
                          const byQuestion = new Map<string, Rush[]>()
                          // rushes triés createdAt DESC par le backend → first = canonical naturelle
                          for (const r of sessionRushes) {
                            const qid = r.question?.id ?? '__no_question__'
                            const list = byQuestion.get(qid) ?? []
                            list.push(r)
                            byQuestion.set(qid, list)
                          }
                          return Array.from(byQuestion.entries()).map(([qid, rushesForQ]) => {
                            const canonical = rushesForQ.find((r) => !r.supersededAt) ?? rushesForQ[0]
                            const variants = rushesForQ.filter((r) => r.id !== canonical.id)
                            const qKey = `${session.id}::${qid}`
                            const expanded = expandedQuestionVariants.has(qKey)
                            return (
                              <div key={qKey} className="space-y-1.5">
                                <RushCard
                                  rush={canonical}
                                  isAdded={addedIds.has(canonical.id)}
                                  onAdd={() => handleAddRush(canonical.id)}
                                  variant="canonical"
                                />
                                {variants.length > 0 && (
                                  <div className="pl-3">
                                    <button
                                      type="button"
                                      onClick={() => toggleQuestionVariants(qKey)}
                                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                      Prises précédentes ({variants.length})
                                    </button>
                                    {expanded && (
                                      <div className="mt-1.5 space-y-1.5">
                                        {variants.map((r) => (
                                          <RushCard
                                            key={r.id}
                                            rush={r}
                                            isAdded={addedIds.has(r.id)}
                                            onAdd={() => handleAddRush(r.id)}
                                            variant="superseded"
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
