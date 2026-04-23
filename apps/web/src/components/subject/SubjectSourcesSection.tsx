'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Relevance = 'FACT' | 'DATA' | 'COUNTERPOINT' | 'CONTEXT'

type Source = {
  title: string
  url: string
  summary: string
  relevance: Relevance
  keyTakeaway: string
}

type StoredSources = {
  sources: Source[]
  query: string
  fetchedAt: string
}

interface SubjectSourcesSectionProps {
  topicId: string
  hasBrief: boolean
  onFlashToast: (message: string) => void
}

const RELEVANCE_META: Record<Relevance, { label: string; tone: string }> = {
  FACT: { label: 'Fait', tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  DATA: { label: 'Chiffre', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  COUNTERPOINT: {
    label: 'Contre-angle',
    tone: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  },
  CONTEXT: {
    label: 'Contexte',
    tone: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
  },
}

function formatDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function SubjectSourcesSection({
  topicId,
  hasBrief,
  onFlashToast,
}: SubjectSourcesSectionProps) {
  const [data, setData] = useState<StoredSources | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)
  // Formulaires inline (éviter modals pour rester dans le flow)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDraft, setAddDraft] = useState<{
    title: string
    url: string
    keyTakeaway: string
    relevance: Relevance
  }>({ title: '', url: '', keyTakeaway: '', relevance: 'CONTEXT' })
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [showSearchForm, setShowSearchForm] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  const [searchSubmitting, setSearchSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/topics/${topicId}/sources`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!alive) return
        if (res.ok) setData((await res.json()) as StoredSources | null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [topicId])

  const handleInitialFetch = useCallback(async () => {
    setFetching(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/sources`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        onFlashToast('Recherche de sources indisponible.')
        return
      }
      const payload = (await res.json()) as StoredSources
      setData(payload)
      if (payload.sources.length === 0) {
        onFlashToast('Aucune source exploitable trouvée pour le moment.')
      } else {
        onFlashToast(
          `${payload.sources.length} source${payload.sources.length > 1 ? 's' : ''} trouvée${payload.sources.length > 1 ? 's' : ''}.`,
        )
      }
    } finally {
      setFetching(false)
    }
  }, [topicId, onFlashToast])

  const handleAddManual = useCallback(async () => {
    const title = addDraft.title.trim()
    const url = addDraft.url.trim()
    if (!title || !url) {
      onFlashToast('Titre et URL requis.')
      return
    }
    setAddSubmitting(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/sources/add`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          url,
          keyTakeaway: addDraft.keyTakeaway.trim() || undefined,
          relevance: addDraft.relevance,
        }),
      })
      if (!res.ok) {
        onFlashToast("Impossible d'ajouter cette source.")
        return
      }
      setData(await res.json())
      setAddDraft({ title: '', url: '', keyTakeaway: '', relevance: 'CONTEXT' })
      setShowAddForm(false)
      onFlashToast('✨ Source ajoutée')
    } finally {
      setAddSubmitting(false)
    }
  }, [addDraft, topicId, onFlashToast])

  const handleSearchMore = useCallback(async () => {
    const query = searchDraft.trim()
    if (!query) return
    setSearchSubmitting(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/sources/search`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) {
        onFlashToast('Recherche indisponible pour le moment.')
        return
      }
      const payload = (await res.json()) as StoredSources
      const prevCount = data?.sources.length ?? 0
      const newCount = payload.sources.length
      setData(payload)
      setSearchDraft('')
      setShowSearchForm(false)
      const delta = newCount - prevCount
      if (delta > 0) {
        onFlashToast(`+${delta} source${delta > 1 ? 's' : ''} ajoutée${delta > 1 ? 's' : ''}.`)
      } else {
        onFlashToast('Aucune nouvelle source exploitable sur cette requête.')
      }
    } finally {
      setSearchSubmitting(false)
    }
  }, [searchDraft, topicId, onFlashToast, data?.sources.length])

  const handleRemove = useCallback(
    async (url: string) => {
      setDeletingUrl(url)
      try {
        const res = await fetch(`/api/topics/${topicId}/sources/remove`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        if (!res.ok) {
          onFlashToast('Impossible de retirer cette source.')
          return
        }
        setData(await res.json())
      } finally {
        setDeletingUrl(null)
      }
    },
    [topicId, onFlashToast],
  )

  if (loading) return null

  const fetchedLabel = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : null

  const hasSources = Boolean(data?.sources?.length)

  return (
    <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          Sources &amp; faits
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowAddForm((v) => !v)
              setShowSearchForm(false)
            }}
            className="text-xs"
          >
            <Plus className="h-3 w-3" />
            Ajouter
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowSearchForm((v) => !v)
              setShowAddForm(false)
            }}
            className="text-xs"
          >
            <Search className="h-3 w-3" />
            Chercher plus
          </Button>
        </div>
      </div>

      {/* Formulaire "Ajouter" inline */}
      {showAddForm && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <input
            type="text"
            value={addDraft.title}
            onChange={(e) => setAddDraft({ ...addDraft, title: e.target.value })}
            placeholder="Titre de la source"
            className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <input
            type="url"
            value={addDraft.url}
            onChange={(e) => setAddDraft({ ...addDraft, url: e.target.value })}
            placeholder="URL (https://…)"
            className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <textarea
            value={addDraft.keyTakeaway}
            onChange={(e) => setAddDraft({ ...addDraft, keyTakeaway: e.target.value })}
            rows={2}
            placeholder="Ta punchline de cette source (optionnel — ce que tu retiens en 1 phrase)"
            className="w-full resize-y rounded-lg border border-border/40 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Type
            </span>
            {(['FACT', 'DATA', 'COUNTERPOINT', 'CONTEXT'] as const).map((r) => {
              const meta = RELEVANCE_META[r]
              const active = addDraft.relevance === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAddDraft({ ...addDraft, relevance: r })}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition ${
                    active ? meta.tone : 'bg-surface text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddManual} disabled={addSubmitting}>
              {addSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Ajouter la source
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddForm(false)
                setAddDraft({ title: '', url: '', keyTakeaway: '', relevance: 'CONTEXT' })
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Formulaire "Chercher plus" inline */}
      {showSearchForm && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Dis à Kabou ce que tu cherches précisément (ex: *chiffres échec projets IA PME 2026* ou
            *contre-argument à la méthode des fruits mûrs*).
          </p>
          <textarea
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            rows={2}
            placeholder="Ta requête précise…"
            className="w-full resize-y rounded-lg border border-border/40 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSearchMore} disabled={searchSubmitting || !searchDraft.trim()}>
              {searchSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Chercher avec Kabou
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowSearchForm(false)
                setSearchDraft('')
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* État : pas encore de sources, et pas de form ouvert → invite initiale */}
      {!hasSources && !showAddForm && !showSearchForm && !fetching && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Avant d'enregistrer, on peut ancrer ton sujet sur quelques sources crédibles — un
            chiffre, un contexte sectoriel, un contre-angle à contester. Kabou s'en servira pour
            muscler tes accroches et ton script format-specific.
          </p>
          <Button size="sm" onClick={handleInitialFetch} disabled={fetching}>
            <Search className="h-3.5 w-3.5" />
            Chercher des sources
          </Button>
          {!hasBrief && (
            <p className="text-xs italic text-muted-foreground">
              Plus ton angle sera précis, mieux Kabou ciblera — mais tu peux déjà tenter.
            </p>
          )}
        </div>
      )}

      {/* État : fetch initial en cours */}
      {!hasSources && fetching && (
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Kabou cherche des sources fiables…
          </p>
        </div>
      )}

      {/* État : sources présentes */}
      {hasSources && data && (
        <>
          {fetchedLabel && (
            <p className="mb-3 text-xs text-muted-foreground/70">Mis à jour le {fetchedLabel}</p>
          )}
          <ul className="space-y-3">
            {data.sources.map((s) => {
              const meta = RELEVANCE_META[s.relevance]
              const isDeleting = deletingUrl === s.url
              return (
                <li
                  key={s.url}
                  className={`rounded-xl border border-border/40 bg-background/40 p-3 transition-opacity ${
                    isDeleting ? 'opacity-50' : ''
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.tone}`}
                      >
                        {meta.label}
                      </span>
                      <span className="truncate text-muted-foreground">{formatDomain(s.url)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(s.url)}
                      disabled={isDeleting}
                      className="shrink-0 rounded-full p-1 text-muted-foreground/50 transition hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Retirer cette source"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <h3 className="mb-1 text-sm font-semibold leading-tight">{s.title}</h3>
                  <p className="mb-2 text-xs text-muted-foreground">{s.summary}</p>
                  <blockquote className="mb-2 border-l-2 border-primary/40 pl-2 text-xs italic">
                    &laquo;&nbsp;{s.keyTakeaway}&nbsp;&raquo;
                  </blockquote>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Ouvrir <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] italic text-muted-foreground/70">
            <Sparkles className="h-3 w-3" />
            Kabou s'appuie sur ces sources quand il génère tes accroches et scripts format-specific.
          </p>
        </>
      )}
    </section>
  )
}
