'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Film, Loader2, Trash2, ChevronRight } from 'lucide-react'
import { FORMAT_CONFIGS, type ContentFormat } from '@lavidz/types'

interface ProjectClip {
  id: string
  order: number
  recording: {
    id: string
    transcript: string | null
    question: { text: string } | null
    session: {
      id: string
      contentFormat: ContentFormat | null
      theme: { id: string; name: string } | null
    }
  }
}

interface Project {
  id: string
  title: string
  status: string
  sessionId: string | null
  clips: ProjectClip[]
  createdAt: string
}

// ─── Design tokens ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  DRAFT:     { dot: '#A1A1AA', label: 'Brouillon' },
  EDITING:   { dot: '#F59E0B', label: 'En montage' },
  RENDERING: { dot: '#3B82F6', label: 'Rendu en cours' },
  DONE:      { dot: '#22C55E', label: 'Terminé' },
  FAILED:    { dot: '#EF4444', label: 'Erreur' },
}

const PASTEL_COLORS = [
  { bg: '#FFE8DC', text: '#9A3412' },
  { bg: '#E0E7FF', text: '#3730A3' },
  { bg: '#DCFCE7', text: '#166534' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#DBEAFE', text: '#1E40AF' },
]

function hashColor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PASTEL_COLORS[h % PASTEL_COLORS.length]
}

function getInitials(title: string): string {
  const words = title.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function ProjectSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-4 bg-surface">
      <div className="w-12 h-12 rounded-2xl bg-muted/30 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 bg-muted/30 animate-pulse rounded-full" />
        <div className="h-3 w-1/3 bg-muted/20 animate-pulse rounded-full" />
      </div>
    </div>
  )
}

// ─── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project
  onOpen: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.DRAFT
  const color = hashColor(project.id)
  const initials = getInitials(project.title)
  const formats = [
    ...new Set(
      project.clips
        .map((c) => c.recording.session.contentFormat)
        .filter(Boolean),
    ),
  ] as ContentFormat[]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
      }}
      className="flex items-center gap-4 px-4 py-4 bg-surface cursor-pointer active:opacity-70 transition-opacity select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {/* Initials avatar */}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-sm font-black"
        style={{ background: color.bg, color: color.text }}
      >
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-bold text-foreground truncate leading-tight">
          {project.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: status.dot }}
          />
          <span className="text-[13px] text-muted-foreground font-medium">
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[12px] text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <Film size={11} />
            {project.clips.length} rush{project.clips.length > 1 ? 'es' : ''}
          </span>
          {formats.length > 0 && (
            <span>
              {formats.map((f) => FORMAT_CONFIGS[f]?.icon).join(' ')}
            </span>
          )}
          <span>
            {new Date(project.createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'short',
            })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0 shrink-0">
        <button
          type="button"
          onClick={onDelete}
          className="w-10 h-10 flex items-center justify-center text-muted-foreground/30 hover:text-red-500 transition-colors rounded-xl hover:bg-red-500/8 active:opacity-60"
          aria-label="Supprimer"
        >
          <Trash2 size={15} />
        </button>
        <ChevronRight size={16} className="text-muted-foreground/30" />
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ProjectsList() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setProjects(Array.isArray(data) ? data : [])
      }
    } catch { /* */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nouveau projet' }),
      })
      if (res.ok) {
        const project = await res.json()
        router.push(`/projects/${project.id}`)
      }
    } catch { /* */ }
    finally { setCreating(false) }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Supprimer ce projet ?')) return
    try {
      await fetch('/api/projects', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch { /* */ }
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (!loading && projects.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 flex flex-col min-h-[70vh]">
        <div className="pt-6 md:pt-8 pb-8">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Projets</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center pb-12">
          <div className="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center">
            <Film size={36} className="text-primary/60" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">Aucun projet</p>
            <p className="text-[15px] text-muted-foreground mt-2 max-w-[240px] leading-relaxed">
              Assemble tes rushes en une vidéo prête à publier.
            </p>
          </div>
        </div>

        <div className="pb-6">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full h-14 bg-primary text-white rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 active:opacity-80 transition-opacity disabled:opacity-50"
          >
            {creating
              ? <Loader2 size={18} className="animate-spin" />
              : <Plus size={18} strokeWidth={2.5} />}
            Nouveau projet
          </button>
        </div>
      </div>
    )
  }

  // ── List state ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="px-4 pt-6 md:pt-8 pb-6">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Projets</h1>
        <p className="text-[14px] text-muted-foreground mt-0.5">
          {loading ? '…' : `${projects.length} projet${projects.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Primary CTA — always visible, full width */}
      <div className="px-4 pb-8">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full h-14 bg-primary text-white rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 active:opacity-80 transition-opacity disabled:opacity-50"
        >
          {creating
            ? <Loader2 size={18} className="animate-spin" />
            : <Plus size={18} strokeWidth={2.5} />}
          Nouveau projet
        </button>
      </div>

      {/* Section label */}
      {!loading && projects.length > 0 && (
        <p className="px-4 pb-3 text-[11px] font-bold uppercase tracking-[0.8px] text-muted-foreground">
          Mes projets
        </p>
      )}

      {/* List */}
      <div className="flex flex-col bg-surface rounded-3xl mx-4 overflow-hidden">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <ProjectSkeleton key={i} />)
          : projects.map((project, i) => (
              <div key={project.id}>
                <ProjectCard
                  project={project}
                  onOpen={() => router.push(`/projects/${project.id}`)}
                  onDelete={(e) => handleDelete(e, project.id)}
                />
                {i < projects.length - 1 && (
                  <div className="ml-[72px] h-px bg-muted/20" />
                )}
              </div>
            ))}
      </div>

      <div className="h-8" />
    </div>
  )
}
