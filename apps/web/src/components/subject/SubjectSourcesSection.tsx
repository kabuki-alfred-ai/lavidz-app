'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ExternalLink,
  Loader2,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubjectSection, SectionChip } from './SubjectSection'
import { SourcesHelp, SourceKindsHelp } from './SubjectHelp'

type Relevance = 'FACT' | 'DATA' | 'COUNTERPOINT' | 'CONTEXT'
type SourceKind = 'ANCRAGE' | 'REFERENCE' | 'VECU'

type Source = {
  title: string
  url: string
  summary: string
  relevance: Relevance
  keyTakeaway: string
  kind?: SourceKind
  /** `undefined` = compat existants, traité comme sélectionnée. */
  selected?: boolean
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
  defaultOpen?: boolean
  id?: string
}

const RELEVANCE_LABEL: Record<Relevance, string> = {
  FACT: 'FAIT',
  DATA: 'CHIFFRE',
  COUNTERPOINT: 'CONTRE-ANGLE',
  CONTEXT: 'CONTEXTE',
}

const KIND_LABEL: Record<SourceKind, string> = {
  ANCRAGE: 'ANCRAGE',
  REFERENCE: 'RÉFÉRENCE',
  VECU: 'VÉCU',
}

function formatDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Dérive le kind éditorial d'une source quand il n'est pas explicitement posé.
 * Heuristique : pas d'URL exploitable → VÉCU ; host livre/auteur connu → RÉFÉRENCE ;
 * sinon → ANCRAGE (défaut sûr pour les liens externes).
 */
function deriveKind(source: Source): SourceKind {
  if (source.kind) return source.kind
  const url = source.url?.trim() ?? ''
  if (!url || !/^https?:\/\//i.test(url)) return 'VECU'
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase()
    } catch {
      return ''
    }
  })()
  if (/goodreads|amazon|babelio|openlibrary|livre|book/.test(host)) return 'REFERENCE'
  return 'ANCRAGE'
}

function makeSlug(source: Source): string {
  try {
    const host = new URL(source.url).hostname.replace(/^www\./, '')
    const parts = host.split('.')[0]
    return parts.slice(0, 3).toUpperCase()
  } catch {
    const letters = source.title.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3)
    return (letters || 'SRC').toUpperCase()
  }
}

export function SubjectSourcesSection({
  topicId,
  hasBrief,
  onFlashToast,
  defaultOpen = false,
  id,
}: SubjectSourcesSectionProps) {
  const [data, setData] = useState<StoredSources | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)
  const [togglingUrl, setTogglingUrl] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDraft, setAddDraft] = useState<{
    title: string
    url: string
    keyTakeaway: string
    relevance: Relevance
    kind: SourceKind
  }>({ title: '', url: '', keyTakeaway: '', relevance: 'CONTEXT', kind: 'ANCRAGE' })
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
      onFlashToast(
        payload.sources.length === 0
          ? 'Aucune source exploitable trouvée pour le moment.'
          : `${payload.sources.length} source${payload.sources.length > 1 ? 's' : ''} trouvée${payload.sources.length > 1 ? 's' : ''}.`,
      )
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
          kind: addDraft.kind,
        }),
      })
      if (!res.ok) {
        onFlashToast("Impossible d'ajouter cette source.")
        return
      }
      setData(await res.json())
      setAddDraft({ title: '', url: '', keyTakeaway: '', relevance: 'CONTEXT', kind: 'ANCRAGE' })
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
      onFlashToast(
        delta > 0
          ? `+${delta} source${delta > 1 ? 's' : ''} ajoutée${delta > 1 ? 's' : ''}.`
          : 'Aucune nouvelle source exploitable sur cette requête.',
      )
    } finally {
      setSearchSubmitting(false)
    }
  }, [searchDraft, topicId, onFlashToast, data?.sources.length])

  const handleToggleSelected = useCallback(
    async (url: string, nextSelected: boolean) => {
      setTogglingUrl(url)
      try {
        const res = await fetch(`/api/topics/${topicId}/sources/toggle`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, selected: nextSelected }),
        })
        if (!res.ok) {
          onFlashToast('Impossible de basculer cette source.')
          return
        }
        setData(await res.json())
        onFlashToast(nextSelected ? '✨ Source ancrée dans la mémoire' : 'Source remise en candidates')
      } finally {
        setTogglingUrl(null)
      }
    },
    [topicId, onFlashToast],
  )

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

  const allSources = data?.sources ?? []
  const { selectedSources, candidateSources } = useMemo(() => {
    const sel: Source[] = []
    const cand: Source[] = []
    for (const s of allSources) {
      // `undefined` = legacy : considéré comme sélectionné.
      if (s.selected === false) cand.push(s)
      else sel.push(s)
    }
    return { selectedSources: sel, candidateSources: cand }
  }, [allSources])
  const count = selectedSources.length
  const candCount = candidateSources.length
  const hasSources = allSources.length > 0

  return (
    <SubjectSection
      id={id}
      number="03"
      title="Les sources"
      subtitle="Pour muscler l'angle avec du factuel — pas juste de l'opinion."
      help={<SourcesHelp />}
      chip={
        hasSources ? (
          <SectionChip>
            {count} ancrage{count > 1 ? 's' : ''}
            {candCount > 0 ? ` · ${candCount} candidate${candCount > 1 ? 's' : ''}` : ''}
          </SectionChip>
        ) : undefined
      }
      defaultOpen={defaultOpen}
    >
      {loading && (
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
        </div>
      )}

      {!loading && (
        <>
          {/* Actions row */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddForm((v) => !v)
                setShowSearchForm(false)
              }}
            >
              <Plus className="h-3 w-3" />
              {showAddForm ? 'Fermer' : 'Ajouter une source'}
            </Button>
            {hasSources && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSearchForm((v) => !v)
                  setShowAddForm(false)
                }}
              >
                <Search className="h-3 w-3" />
                Chercher plus
              </Button>
            )}
          </div>

          {showAddForm && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 max-w-[680px]">
              <input
                type="text"
                value={addDraft.title}
                onChange={(e) => setAddDraft({ ...addDraft, title: e.target.value })}
                placeholder="Titre de la source"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <input
                type="url"
                value={addDraft.url}
                onChange={(e) => setAddDraft({ ...addDraft, url: e.target.value })}
                placeholder="URL (https://…)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <textarea
                value={addDraft.keyTakeaway}
                onChange={(e) => setAddDraft({ ...addDraft, keyTakeaway: e.target.value })}
                rows={2}
                placeholder="Ta punchline de cette source (optionnel)"
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Rôle éditorial
                </span>
                <SourceKindsHelp />
                {(['ANCRAGE', 'REFERENCE', 'VECU'] as const).map((k) => {
                  const active = addDraft.kind === k
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAddDraft({ ...addDraft, kind: k })}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider transition ${
                        active
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'bg-surface-raised border border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Nature factuelle
                </span>
                {(['FACT', 'DATA', 'COUNTERPOINT', 'CONTEXT'] as const).map((r) => {
                  const active = addDraft.relevance === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAddDraft({ ...addDraft, relevance: r })}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider transition ${
                        active
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'bg-surface-raised border border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {RELEVANCE_LABEL[r]}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddManual} disabled={addSubmitting}>
                  {addSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Ajouter
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false)
                    setAddDraft({ title: '', url: '', keyTakeaway: '', relevance: 'CONTEXT', kind: 'ANCRAGE' })
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {showSearchForm && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 max-w-[680px]">
              <p className="text-xs text-muted-foreground">
                Dis à Kabou ce que tu cherches précisément.
              </p>
              <textarea
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                rows={2}
                placeholder="Ta requête précise…"
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSearchMore} disabled={searchSubmitting || !searchDraft.trim()}>
                  {searchSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Chercher avec Kabou
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
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

          {!hasSources && !showAddForm && !showSearchForm && !fetching && (
            <div className="rounded-xl border border-dashed border-border bg-surface-raised/20 p-5 max-w-[680px] space-y-3">
              <p className="text-sm text-muted-foreground">
                Avant d'enregistrer, on peut ancrer ton sujet sur quelques sources crédibles — un chiffre, un contexte, un contre-angle.
              </p>
              <Button size="sm" onClick={handleInitialFetch} disabled={fetching}>
                <Search className="h-3.5 w-3.5" />
                Chercher des sources
              </Button>
              {!hasBrief && (
                <p className="text-xs italic text-muted-foreground">
                  Plus ton angle sera précis, mieux Kabou ciblera.
                </p>
              )}
            </div>
          )}

          {!hasSources && fetching && (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Kabou cherche des sources fiables…
            </div>
          )}

          {hasSources && data && (
            <div className="max-w-[680px] space-y-5">
              <SourceGroup
                title="Ancrées dans la mémoire IA"
                hint={
                  count === 0
                    ? 'Aucune encore. Épingle une candidate ci-dessous ou ajoute-en une manuellement.'
                    : `${count} source${count > 1 ? 's' : ''} que Kabou utilise pour nourrir ses propositions.`
                }
                sources={selectedSources}
                selectedVisual
                onTogglePin={(url) => handleToggleSelected(url, false)}
                onRemove={handleRemove}
                togglingUrl={togglingUrl}
                deletingUrl={deletingUrl}
              />
              {candidateSources.length > 0 && (
                <SourceGroup
                  title="Candidates"
                  hint={`${candCount} source${candCount > 1 ? 's' : ''} trouvée${candCount > 1 ? 's' : ''} — épingle celles qui comptent, Kabou n'utilise que les ancrées.`}
                  sources={candidateSources}
                  selectedVisual={false}
                  onTogglePin={(url) => handleToggleSelected(url, true)}
                  onRemove={handleRemove}
                  togglingUrl={togglingUrl}
                  deletingUrl={deletingUrl}
                />
              )}
            </div>
          )}
        </>
      )}
    </SubjectSection>
  )
}

interface SourceGroupProps {
  title: string
  hint: string
  sources: Source[]
  selectedVisual: boolean
  onTogglePin: (url: string) => void
  onRemove: (url: string) => void
  togglingUrl: string | null
  deletingUrl: string | null
}

function SourceGroup({
  title,
  hint,
  sources,
  selectedVisual,
  onTogglePin,
  onRemove,
  togglingUrl,
  deletingUrl,
}: SourceGroupProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground/70">
          {sources.length}
        </span>
      </div>
      <p className="mb-2.5 text-[12px] text-muted-foreground/80">{hint}</p>
      <div className="space-y-2.5">
        {sources.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-surface-raised/20 p-4 text-[12.5px] italic text-muted-foreground">
            — aucune pour le moment —
          </p>
        )}
        {sources.map((s) => {
          const slug = makeSlug(s)
          const kind = deriveKind(s)
          const label = KIND_LABEL[kind]
          const isDeleting = deletingUrl === s.url
          const isToggling = togglingUrl === s.url
          return (
            <div
              key={s.url}
              className={`group flex items-start gap-3 rounded-xl border p-4 transition ${
                selectedVisual
                  ? 'border-primary/30 bg-primary/[0.04] hover:bg-primary/[0.07]'
                  : 'border-dashed border-border bg-surface-raised/20 hover:bg-surface-raised/40'
              } ${isDeleting || isToggling ? 'opacity-60' : ''}`}
            >
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center text-[10px] font-mono shrink-0 ${
                  selectedVisual ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {slug}
              </div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0"
              >
                <p className="text-[14px] font-medium leading-tight">{s.title}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                  {formatDomain(s.url)}
                  {s.summary ? ` · ${s.summary}` : ''}
                </p>
                {s.keyTakeaway && (
                  <p className="text-[12px] italic text-muted-foreground/80 mt-1 line-clamp-2">
                    «&nbsp;{s.keyTakeaway}&nbsp;»
                  </p>
                )}
              </a>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-[10px] font-mono tracking-widest text-muted-foreground/70">
                  {label}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onTogglePin(s.url)}
                    disabled={isToggling}
                    title={selectedVisual ? 'Retirer de la mémoire IA' : 'Ancrer dans la mémoire IA'}
                    aria-label={selectedVisual ? 'Désancrer' : 'Ancrer'}
                    className={`rounded-full p-1 transition ${
                      selectedVisual
                        ? 'text-primary hover:bg-primary/15'
                        : 'text-muted-foreground/60 hover:bg-surface-raised hover:text-foreground'
                    }`}
                  >
                    {isToggling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : selectedVisual ? (
                      <Pin className="h-3.5 w-3.5" />
                    ) : (
                      <PinOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition opacity-0 group-hover:opacity-100"
                    aria-label="Ouvrir la source"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onRemove(s.url)}
                    disabled={isDeleting}
                    className="rounded-full p-1 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive transition opacity-0 group-hover:opacity-100"
                    aria-label="Retirer cette source"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
