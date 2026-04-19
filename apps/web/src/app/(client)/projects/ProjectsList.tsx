'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FolderOpen, Film, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  DRAFT: { label: 'Brouillon', class: 'bg-muted text-muted-foreground' },
  EDITING: { label: 'En montage', class: 'bg-amber-500/10 text-amber-600' },
  RENDERING: { label: 'Rendu en cours', class: 'bg-blue-500/10 text-blue-600' },
  DONE: { label: 'Termine', class: 'bg-emerald-500/10 text-emerald-600' },
  FAILED: { label: 'Erreur', class: 'bg-red-500/10 text-red-600' },
}

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

  if (!loading && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center">
          <FolderOpen size={24} className="text-primary/40" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Aucun projet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Cree ton premier projet pour assembler tes rushes en une video.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating} className="gap-2">
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Nouveau projet
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Projets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length} projet{projects.length > 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating} size="sm" className="gap-2">
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Nouveau projet
        </Button>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/20 animate-pulse rounded-xl" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid gap-3">
          {projects.map((project) => {
            const status = STATUS_LABELS[project.status] ?? STATUS_LABELS.DRAFT
            const formats = [...new Set(project.clips.map((c) => c.recording.session.contentFormat).filter(Boolean))] as ContentFormat[]

            return (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/projects/${project.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    router.push(`/projects/${project.id}`)
                  }
                }}
                className="w-full text-left rounded-xl bg-card border-2 border-border/50 p-4 hover:border-primary/30 hover:shadow-md transition-all hover:scale-[1.005] active:scale-[0.995] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-foreground truncate">{project.title}</h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${status.class}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Film size={12} />
                        {project.clips.length} rush{project.clips.length > 1 ? 'es' : ''}
                      </span>
                      {formats.length > 0 && (
                        <span className="flex items-center gap-1">
                          {formats.map((f) => (
                            <span key={f} className="inline-flex items-center gap-0.5">
                              <span className="text-xs">{FORMAT_CONFIGS[f]?.icon}</span>
                              <span className="text-[10px]">{FORMAT_CONFIGS[f]?.label}</span>
                            </span>
                          ))}
                        </span>
                      )}
                      <span>
                        {new Date(project.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, project.id)}
                    className="p-2 text-muted-foreground/40 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
