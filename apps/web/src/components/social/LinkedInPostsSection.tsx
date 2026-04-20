'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles, Copy, Check, RefreshCw, Trash2, Linkedin, ExternalLink } from 'lucide-react'
import { LinkedInPreview } from './LinkedInPreview'

interface GeneratedPost {
  id: string
  platform: 'LINKEDIN' | 'X' | 'THREADS'
  variant: 'SHORT' | 'LONG' | 'STORY'
  content: string
  status: 'DRAFT' | 'READY' | 'PUBLISHED'
  createdAt: string
}

interface Props {
  /** endpoint base path, e.g. `/api/topics/abc/linkedin-posts` */
  endpoint: string
  authorName: string
  authorTitle?: string
  /** Variant label for the empty-state CTA, e.g. "Générer 3 posts depuis ce sujet" */
  generateLabel?: string
  /** Optional: when true, the user can't generate yet (e.g. session not DONE) */
  disabled?: boolean
  disabledReason?: string
}

const VARIANT_LABEL: Record<GeneratedPost['variant'], { label: string; color: string }> = {
  SHORT: { label: 'Court', color: '#0A66C2' },
  LONG:  { label: 'Long',  color: '#059669' },
  STORY: { label: 'Story', color: '#A855F7' },
}

export function LinkedInPostsSection({
  endpoint,
  authorName,
  authorTitle,
  generateLabel = 'Générer 3 posts LinkedIn',
  disabled = false,
  disabledReason,
}: Props) {
  const [posts, setPosts] = useState<GeneratedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPosts(Array.isArray(data) ? data : [])
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include' })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || `Erreur ${res.status}`)
      }
      const created = await res.json()
      if (Array.isArray(created)) {
        setPosts((prev) => [...created, ...prev])
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erreur génération')
    } finally {
      setGenerating(false)
    }
  }

  const copyToClipboard = async (post: GeneratedPost) => {
    try {
      await navigator.clipboard.writeText(post.content)
      setCopiedId(post.id)
      setTimeout(() => setCopiedId((c) => (c === post.id ? null : c)), 1800)
    } catch { /* clipboard blocked */ }
  }

  const deletePost = async (post: GeneratedPost) => {
    const prev = posts
    setPosts((p) => p.filter((x) => x.id !== post.id))
    try {
      const res = await fetch(`${endpoint}?postId=${post.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error(await res.text())
    } catch (e: any) {
      setError(e?.message ?? 'Erreur suppression')
      setPosts(prev)
    }
  }

  // Empty / loading states
  if (loading) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Linkedin size={14} className="text-[#0A66C2]" />
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Posts LinkedIn
            {posts.length > 0 && <span className="ml-1.5 text-muted-foreground">({posts.length})</span>}
          </p>
        </div>
        {posts.length > 0 && !disabled && (
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Régénérer
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 px-1">{error}</p>
      )}

      {posts.length === 0 && (
        disabled ? (
          <div className="rounded-xl border-2 border-dashed border-border/40 p-6 text-center">
            <p className="text-xs text-muted-foreground/70">{disabledReason ?? 'Indisponible pour le moment.'}</p>
          </div>
        ) : (
          <button
            onClick={generate}
            disabled={generating}
            className="w-full rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-colors p-6 flex flex-col items-center gap-2 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 size={20} className="text-primary animate-spin" />
                <span className="text-sm font-medium text-foreground">Génération en cours…</span>
                <span className="text-xs text-muted-foreground">Cela peut prendre 10-20s</span>
              </>
            ) : (
              <>
                <Sparkles size={20} className="text-primary" />
                <span className="text-sm font-medium text-foreground">{generateLabel}</span>
                <span className="text-xs text-muted-foreground">3 variantes : Court · Long · Story</span>
              </>
            )}
          </button>
        )
      )}

      {posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((post) => {
            const meta = VARIANT_LABEL[post.variant]
            return (
              <div key={post.id} className="rounded-xl border border-border/40 bg-card/50 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{
                      color: meta.color,
                      background: `${meta.color}14`,
                      border: `1px solid ${meta.color}33`,
                    }}
                  >
                    {meta.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyToClipboard(post)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      {copiedId === post.id ? (
                        <><Check size={11} className="text-emerald-500" /> Copié</>
                      ) : (
                        <><Copy size={11} /> Copier</>
                      )}
                    </button>
                    <a
                      href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(post.content)}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => copyToClipboard(post)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#0A66C2] hover:bg-[#0A66C2]/10 transition-colors"
                      title="Ouvre LinkedIn avec ce post pré-rempli — on copie aussi au presse-papier au cas où"
                    >
                      <ExternalLink size={11} /> Ouvrir sur LinkedIn
                    </a>
                    <button
                      onClick={() => deletePost(post)}
                      aria-label="Supprimer"
                      className="p-1.5 rounded-md text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                <LinkedInPreview
                  authorName={authorName}
                  authorTitle={authorTitle}
                  content={post.content}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
