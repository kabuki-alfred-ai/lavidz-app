'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, ExternalLink, Loader2, RefreshCw, Search } from 'lucide-react'
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

const RELEVANCE_META: Record<
  Relevance,
  { label: string; tone: string }
> = {
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

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/topics/${topicId}/sources`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!alive) return
        if (res.ok) {
          const payload = (await res.json()) as StoredSources | null
          setData(payload)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [topicId])

  const handleFetch = useCallback(async () => {
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
        onFlashToast(`${payload.sources.length} source${payload.sources.length > 1 ? 's' : ''} trouvée${payload.sources.length > 1 ? 's' : ''}.`)
      }
    } finally {
      setFetching(false)
    }
  }, [topicId, onFlashToast])

  if (loading) return null

  const fetchedLabel = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      })
    : null

  return (
    <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          Sources &amp; faits
        </h2>
        {data && data.sources.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleFetch}
            disabled={fetching}
            className="text-xs"
          >
            {fetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Rafraîchir
          </Button>
        )}
      </div>

      {!data && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Avant d'enregistrer, on peut ancrer ton sujet sur quelques sources crédibles — un chiffre,
            un contexte sectoriel, un contre-angle à contester. Pratique surtout pour les réactions et
            les prises de position.
          </p>
          <Button size="sm" onClick={handleFetch} disabled={fetching || !hasBrief}>
            {fetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Chercher des sources
          </Button>
          {!hasBrief && (
            <p className="text-xs italic text-muted-foreground">
              Travaille un angle avant — la recherche sera plus précise.
            </p>
          )}
        </div>
      )}

      {data && data.sources.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm italic text-muted-foreground">
            Pas de source crédible trouvée la dernière fois. Précise ton angle ou relance.
          </p>
          <Button size="sm" variant="outline" onClick={handleFetch} disabled={fetching}>
            {fetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Relancer la recherche
          </Button>
        </div>
      )}

      {data && data.sources.length > 0 && (
        <>
          {fetchedLabel && (
            <p className="mb-3 text-xs text-muted-foreground/70">
              Mis à jour le {fetchedLabel}
            </p>
          )}
          <ul className="space-y-3">
            {data.sources.map((s, i) => {
              const meta = RELEVANCE_META[s.relevance]
              return (
                <li
                  key={i}
                  className="rounded-xl border border-border/40 bg-background/40 p-3"
                >
                  <div className="mb-1.5 flex items-center gap-2 text-xs">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.tone}`}
                    >
                      {meta.label}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {formatDomain(s.url)}
                    </span>
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
        </>
      )}
    </section>
  )
}
