'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, X, GripVertical, Film,
  Check, ChevronDown, ChevronRight, Play, Pause, Clapperboard, Star, Search,
} from 'lucide-react'
import { Drawer } from 'vaul'
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
  supersededAt?: string | null
  kabouRecommendation?: { score: number; reason: string } | null
  question: { id: string; text: string } | null
  session: { id: string; createdAt: string; contentFormat: ContentFormat | null; theme: { id: string; name: string } | null }
}

interface ProjectClip { id: string; order: number; recording: Rush }
interface Project { id: string; title: string; status: string; clips: ProjectClip[] }

/* ------------------------------------------------------------------ */
/* Video preview                                                       */
/* ------------------------------------------------------------------ */

function RushPreview({ recordingId, sessionId }: { recordingId: string; sessionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  function toggle() {
    const el = videoRef.current; if (!el) return
    if (el.paused) { el.play(); setPlaying(true) } else { el.pause(); setPlaying(false) }
  }
  return (
    <div className="relative group rounded-2xl overflow-hidden bg-black aspect-video mt-3">
      <video ref={videoRef} src={`/api/video/${recordingId}?sessionId=${sessionId}`}
        preload="metadata" playsInline className="w-full h-full object-contain"
        onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      <button onClick={toggle} className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
          {playing ? <Pause size={18} className="text-black" /> : <Play size={18} className="text-black ml-0.5" />}
        </div>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Rush row — compact, library style                                   */
/* ------------------------------------------------------------------ */

function RushRow({ rush, isAdded, onAdd }: { rush: Rush; isAdded: boolean; onAdd: () => void }) {
  const [showPreview, setShowPreview] = useState(false)
  const fmt = rush.session.contentFormat ? FORMAT_CONFIGS[rush.session.contentFormat] : null
  const hasVideo = !!rush.rawVideoKey
  const label = rush.question?.text ?? rush.transcript?.slice(0, 80) ?? 'Rush'

  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${isAdded ? 'opacity-50' : ''}`}>
      {/* Play */}
      {hasVideo ? (
        <button onClick={() => setShowPreview(v => !v)}
          className="shrink-0 w-10 h-10 rounded-xl bg-black flex items-center justify-center active:opacity-70">
          {showPreview ? <Pause size={12} className="text-white" /> : <Play size={12} className="text-white ml-0.5" />}
        </button>
      ) : (
        <div className="shrink-0 w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
          <Film size={14} className="text-muted-foreground/40" />
        </div>
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {fmt && <span className="text-[11px] text-muted-foreground shrink-0">{fmt.icon}</span>}
          {rush.kabouRecommendation && (
            <Star size={10} className="text-amber-500 fill-current shrink-0" />
          )}
          <p className="text-[14px] font-semibold text-foreground truncate">{label}</p>
        </div>
        {rush.kabouRecommendation?.reason && (
          <p className="text-[11px] text-amber-700/70 truncate mt-0.5">{rush.kabouRecommendation.reason}</p>
        )}
      </div>

      {/* Add */}
      <button onClick={onAdd} disabled={isAdded}
        className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
          isAdded ? 'bg-primary/10 text-primary' : 'bg-primary text-white active:opacity-70'
        }`}>
        {isAdded ? <Check size={14} /> : <Plus size={16} />}
      </button>

      {showPreview && hasVideo && (
        <div className="col-span-full w-full">
          <RushPreview recordingId={rush.id} sessionId={rush.session.id} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Timeline clip row                                                   */
/* ------------------------------------------------------------------ */

function TimelineRow({ clip, onRemove, onDragStart, onDragOver, onDrop }: {
  clip: ProjectClip; onRemove: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}) {
  const fmt = clip.recording.session.contentFormat ? FORMAT_CONFIGS[clip.recording.session.contentFormat] : null
  const label = clip.recording.question?.text ?? 'Rush'

  return (
    <div draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}
      className="flex items-center gap-3 px-4 py-4 cursor-grab active:cursor-grabbing active:opacity-60">
      <GripVertical size={16} className="text-muted-foreground/25 shrink-0" />
      <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-[11px] font-black text-primary shrink-0">
        {clip.order + 1}
      </div>
      {fmt && <span className="text-base shrink-0">{fmt.icon}</span>}
      <p className="flex-1 text-[15px] font-semibold text-foreground truncate">{label}</p>
      <button onClick={onRemove}
        className="shrink-0 w-10 h-10 flex items-center justify-center text-muted-foreground/30 hover:text-red-500 rounded-xl transition-colors">
        <X size={16} />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Library bottom sheet                                                */
/* ------------------------------------------------------------------ */

function LibrarySheet({
  open, onClose,
  rushes, rushesLoading, addedIds,
  formatFilter, setFormatFilter,
  searchQuery, setSearchQuery,
  availableFormats, groupedRushes,
  collapsedSessions, toggleSession,
  expandedVariants, toggleVariants,
  onAdd, onAddMany,
}: {
  open: boolean; onClose: () => void
  rushes: Rush[]; rushesLoading: boolean; addedIds: Set<string>
  formatFilter: string; setFormatFilter: (v: string) => void
  searchQuery: string; setSearchQuery: (v: string) => void
  availableFormats: ContentFormat[]
  groupedRushes: { session: Rush['session']; rushes: Rush[] }[]
  collapsedSessions: Set<string>; toggleSession: (id: string) => void
  expandedVariants: Set<string>; toggleVariants: (k: string) => void
  onAdd: (id: string) => void; onAddMany: (ids: string[]) => void
}) {
  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-background rounded-t-3xl"
          style={{ maxHeight: '92dvh' }}>
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0">
            <div>
              <h2 className="text-[19px] font-black tracking-tight">Ajouter des rushes</h2>
              <p className="text-[13px] text-muted-foreground">
                {rushes.length} rush{rushes.length > 1 ? 'es' : ''} disponibles
              </p>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center active:opacity-60">
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pb-3 shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
              <input
                type="text"
                placeholder="Rechercher…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-2xl bg-surface text-[14px] outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Format chips */}
          {availableFormats.length > 0 && (
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide shrink-0">
              <button
                onClick={() => setFormatFilter('')}
                className={`shrink-0 h-8 px-4 rounded-full text-[12px] font-semibold transition-colors ${
                  formatFilter === '' ? 'bg-primary text-white' : 'bg-muted/40 text-muted-foreground'
                }`}>
                Tous
              </button>
              {availableFormats.map((f) => (
                <button key={f}
                  onClick={() => setFormatFilter(formatFilter === f ? '' : f)}
                  className={`shrink-0 h-8 px-4 rounded-full text-[12px] font-semibold transition-colors ${
                    formatFilter === f ? 'bg-primary text-white' : 'bg-muted/40 text-muted-foreground'
                  }`}>
                  {FORMAT_CONFIGS[f]?.icon} {FORMAT_CONFIGS[f]?.label}
                </button>
              ))}
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {rushesLoading ? (
              <div className="space-y-3 px-4 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 bg-muted/20 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : rushes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <Film size={32} className="text-muted-foreground/25" />
                <p className="text-[15px] font-bold">Aucun rush disponible</p>
                <p className="text-[13px] text-muted-foreground">Enregistre des sessions pour alimenter ta bibliothèque.</p>
              </div>
            ) : (
              <div className="space-y-3 px-4 pb-6">
                {groupedRushes.map(({ session, rushes: sr }) => {
                  const fmt = session.contentFormat ? FORMAT_CONFIGS[session.contentFormat] : null
                  const collapsed = collapsedSessions.has(session.id)
                  const notAdded = sr.filter(r => !addedIds.has(r.id))
                  const allAdded = notAdded.length === 0

                  return (
                    <div key={session.id} className="bg-surface rounded-3xl overflow-hidden">
                      {/* Session header */}
                      <div className="flex items-center gap-2 px-4 py-3 bg-muted/15">
                        <button onClick={() => toggleSession(session.id)}
                          className="w-8 h-8 flex items-center justify-center text-muted-foreground shrink-0">
                          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {fmt && <span className="text-[11px] font-bold text-muted-foreground uppercase">{fmt.icon} {fmt.label}</span>}
                            {session.theme && <span className="text-[13px] font-bold text-foreground truncate">{session.theme.name}</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground/60">
                            {sr.length} rush{sr.length > 1 ? 'es' : ''} · {sr.length - notAdded.length} ajouté{sr.length - notAdded.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        {!allAdded && (
                          <button onClick={() => onAddMany(notAdded.map(r => r.id))}
                            className="shrink-0 text-[12px] font-bold text-primary px-3 py-1.5 rounded-xl active:opacity-60 min-h-[36px]">
                            Tout ajouter
                          </button>
                        )}
                      </div>

                      {!collapsed && (
                        <div className="flex flex-col divide-y divide-muted/15">
                          {(() => {
                            const byQ = new Map<string, Rush[]>()
                            for (const r of sr) {
                              const qid = r.question?.id ?? '__noq__'
                              byQ.set(qid, [...(byQ.get(qid) ?? []), r])
                            }
                            return Array.from(byQ.entries()).map(([qid, rushesForQ]) => {
                              const canonical = rushesForQ.find(r => !r.supersededAt) ?? rushesForQ[0]
                              const variants = rushesForQ.filter(r => r.id !== canonical.id)
                              const qKey = `${session.id}::${qid}`
                              const expanded = expandedVariants.has(qKey)
                              return (
                                <div key={qKey}>
                                  <RushRow rush={canonical} isAdded={addedIds.has(canonical.id)} onAdd={() => onAdd(canonical.id)} />
                                  {variants.length > 0 && (
                                    <div className="px-4 pb-2">
                                      <button onClick={() => toggleVariants(qKey)}
                                        className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold active:opacity-60">
                                        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                        {variants.length} prise{variants.length > 1 ? 's' : ''} précédente{variants.length > 1 ? 's' : ''}
                                      </button>
                                      {expanded && (
                                        <div className="mt-2 rounded-2xl overflow-hidden bg-muted/10 flex flex-col divide-y divide-muted/15">
                                          {variants.map(r => (
                                            <RushRow key={r.id} rush={r} isAdded={addedIds.has(r.id)} onAdd={() => onAdd(r.id)} />
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
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
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
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [formatFilter, setFormatFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set())
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch('/api/projects', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const found = (Array.isArray(data) ? data : []).find((p: Project) => p.id === projectId)
        if (found) setProject(found)
      }
    } catch { /* */ } finally { setLoading(false) }
  }, [projectId])

  const fetchRushes = useCallback(async () => {
    setRushesLoading(true)
    try {
      const params = new URLSearchParams()
      if (formatFilter) params.set('format', formatFilter)
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`/api/projects/rushes?${params}`, { credentials: 'include' })
      if (res.ok) { const data = await res.json(); setRushes(Array.isArray(data) ? data : []) }
    } catch { /* */ } finally { setRushesLoading(false) }
  }, [formatFilter, searchQuery])

  useEffect(() => { fetchProject() }, [fetchProject])
  useEffect(() => { if (libraryOpen) fetchRushes() }, [fetchRushes, libraryOpen])

  const addedIds = useMemo(() => new Set(project?.clips.map(c => c.recording.id) ?? []), [project])

  async function handleAddRush(recordingId: string) {
    try {
      await fetch('/api/projects/clips', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, recordingId }),
      })
      await fetchProject()
    } catch { /* */ }
  }

  async function handleAddMany(ids: string[]) {
    for (const id of ids) {
      try {
        await fetch('/api/projects/clips', {
          method: 'POST', credentials: 'include',
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
        method: 'DELETE', credentials: 'include',
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
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, clipIds: reordered.map(c => c.id) }),
      })
    } catch { await fetchProject() }
  }

  async function handleTitleSave() {
    if (!titleDraft.trim() || !project) return
    setEditingTitle(false)
    setProject({ ...project, title: titleDraft.trim() })
    try {
      await fetch('/api/projects', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, title: titleDraft.trim() }),
      })
    } catch { /* */ }
  }

  const availableFormats = useMemo(() => {
    const fmts = new Set(rushes.map(r => r.session.contentFormat).filter(Boolean))
    return [...fmts] as ContentFormat[]
  }, [rushes])

  const groupedRushes = useMemo(() => {
    const map = new Map<string, { session: Rush['session']; rushes: Rush[] }>()
    for (const r of rushes) {
      const e = map.get(r.session.id)
      if (e) e.rushes.push(r)
      else map.set(r.session.id, { session: r.session, rushes: [r] })
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.session.createdAt).getTime() - new Date(a.session.createdAt).getTime()
    )
  }, [rushes])

  const toggleSession = (id: string) =>
    setCollapsedSessions(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleVariants = (k: string) =>
    setExpandedVariants(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="w-24 h-8 bg-muted/30 animate-pulse rounded-xl" />
        <div className="w-48 h-9 bg-muted/30 animate-pulse rounded-xl" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted/20 animate-pulse rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <p className="text-lg font-bold">Projet introuvable</p>
        <button onClick={() => router.push('/projects')}
          className="flex items-center gap-2 text-primary font-bold text-[15px] active:opacity-60">
          <ArrowLeft size={18} strokeWidth={2.5} /> Retour
        </button>
      </div>
    )
  }

  const sortedClips = [...project.clips].sort((a, b) => a.order - b.order)
  const hasMontage = sortedClips.length > 0

  return (
    <>
      <div
        className="max-w-2xl mx-auto"
        style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* ── Back header ── */}
        <div
          className="sticky top-0 z-20 flex items-center justify-between px-4 py-2"
          style={{ background: 'rgba(250,250,247,0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
        >
          <button
            onClick={() => router.push('/projects')}
            className="flex items-center gap-1 text-primary font-bold text-[16px] min-h-[44px] active:opacity-60 select-none"
          >
            <ArrowLeft size={22} strokeWidth={2.5} /> Studio
          </button>
          {hasMontage && (
            <button
              onClick={() => router.push(`/process/project/${projectId}`)}
              className="hidden md:flex items-center gap-2 h-11 px-5 bg-primary text-white rounded-2xl text-[14px] font-bold active:opacity-80"
            >
              <Clapperboard size={16} /> Monter
            </button>
          )}
        </div>

        {/* ── Title ── */}
        <div className="px-4 pt-3 pb-6">
          {editingTitle ? (
            <input autoFocus value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
              className="text-3xl font-black tracking-tight text-foreground bg-transparent outline-none w-full border-b-2 border-primary pb-1" />
          ) : (
            <h1
              onClick={() => { setEditingTitle(true); setTitleDraft(project.title) }}
              className="text-3xl font-black tracking-tight text-foreground cursor-text"
            >
              {project.title}
            </h1>
          )}
          <p className="text-[14px] text-muted-foreground mt-1">
            {sortedClips.length} rush{sortedClips.length > 1 ? 'es' : ''} sélectionné{sortedClips.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* ── Timeline ── */}
        <p className="text-[11px] font-black uppercase tracking-[0.8px] text-muted-foreground px-4 pb-3">
          Sélection
        </p>

        {sortedClips.length === 0 ? (
          <div className="mx-4 bg-surface rounded-3xl px-6 py-12 text-center flex flex-col items-center gap-3">
            <Film size={36} className="text-muted-foreground/20" />
            <p className="text-[17px] font-bold text-foreground">Aucun rush sélectionné</p>
            <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[220px]">
              Ajoute des rushes depuis ta bibliothèque pour composer ta vidéo.
            </p>
          </div>
        ) : (
          <div className="mx-4 bg-surface rounded-3xl overflow-hidden flex flex-col divide-y divide-muted/15">
            {sortedClips.map((clip, idx) => (
              <TimelineRow
                key={clip.id}
                clip={clip}
                onRemove={() => handleRemoveClip(clip.id)}
                onDragStart={() => setDragIdx(idx)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragIdx !== null) handleReorder(dragIdx, idx); setDragIdx(null) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Fixed bottom bar ── */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 flex flex-col gap-2 px-4 pt-3"
        style={{
          maxWidth: 672, margin: '0 auto',
          background: 'rgba(250,250,247,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {hasMontage && (
          <button
            onClick={() => router.push(`/process/project/${projectId}`)}
            className="md:hidden w-full h-14 bg-primary text-white rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 active:opacity-80"
          >
            <Clapperboard size={18} /> Lancer le montage
          </button>
        )}
        <button
          onClick={() => setLibraryOpen(true)}
          className={`w-full h-12 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 active:opacity-80 transition-colors ${
            hasMontage
              ? 'bg-surface text-foreground'
              : 'bg-primary text-white'
          }`}
        >
          <Plus size={18} strokeWidth={2.5} /> Ajouter des rushes
        </button>
      </div>

      {/* ── Library bottom sheet ── */}
      <LibrarySheet
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        rushes={rushes}
        rushesLoading={rushesLoading}
        addedIds={addedIds}
        formatFilter={formatFilter}
        setFormatFilter={setFormatFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        availableFormats={availableFormats}
        groupedRushes={groupedRushes}
        collapsedSessions={collapsedSessions}
        toggleSession={toggleSession}
        expandedVariants={expandedVariants}
        toggleVariants={toggleVariants}
        onAdd={handleAddRush}
        onAddMany={handleAddMany}
      />
    </>
  )
}
