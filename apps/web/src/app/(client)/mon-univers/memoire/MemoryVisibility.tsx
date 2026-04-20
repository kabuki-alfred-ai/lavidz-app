'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Brain,
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Waypoints,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KABOU_TOASTS } from '@/lib/kabou-voice'

type Profile = {
  id: string
  businessContext: Record<string, unknown> | null
  communicationStyle: string | null
  editorialPillars: string[]
  editorialTone: string | null
  targetFrequency: number | null
  targetPlatforms: string[]
  topicsExplored: string[]
  linkedinUrl: string | null
  websiteUrl: string | null
  linkedinIngestedAt: string | null
  websiteIngestedAt: string | null
}

type Memory = {
  id: string
  content: string
  tags: string[]
  sessionId: string | null
  createdAt: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function stringifySummary(businessContext: Record<string, unknown> | null): string {
  if (!businessContext) return ''
  const summary = (businessContext.summary as Record<string, unknown> | undefined) ?? businessContext
  const parts: string[] = []
  const keys: Record<string, string> = {
    activite: 'Activité',
    stade: 'Stade',
    clientsCibles: 'Cible',
    problemeResolu: 'Problème résolu',
    objectifsContenu: 'Objectifs contenu',
    styleComm: 'Style de communication',
    description: 'Description',
  }
  for (const [key, label] of Object.entries(keys)) {
    const value = summary[key]
    if (typeof value === 'string' && value.trim()) {
      parts.push(`**${label}** : ${value}`)
    }
  }
  return parts.join('\n')
}

export function MemoryVisibility() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Partial<Profile>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [deletingMemory, setDeletingMemory] = useState<string | null>(null)

  const flashToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2400)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [profileRes, memRes] = await Promise.all([
        fetch('/api/mon-univers/profile', { credentials: 'include' }),
        fetch('/api/mon-univers/memoire?limit=50', { credentials: 'include' }),
      ])
      if (profileRes.ok) setProfile(await profileRes.json())
      if (memRes.ok) {
        const data = await memRes.json()
        setMemories(data.memories ?? [])
      }
    } catch {
      flashToast(KABOU_TOASTS.oops)
    } finally {
      setLoading(false)
    }
  }, [flashToast])

  useEffect(() => {
    load()
  }, [load])

  const savePatch = useCallback(
    async (patch: Partial<Profile>) => {
      try {
        const res = await fetch('/api/mon-univers/profile', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(patch),
        })
        if (!res.ok) {
          flashToast(KABOU_TOASTS.oops)
          return false
        }
        const updated = await res.json()
        setProfile(updated)
        flashToast(KABOU_TOASTS.memoryUpdated)
        return true
      } catch {
        flashToast(KABOU_TOASTS.oops)
        return false
      }
    },
    [flashToast],
  )

  const deleteMemory = useCallback(
    async (id: string) => {
      setDeletingMemory(id)
      try {
        const res = await fetch(`/api/mon-univers/memoire/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (res.ok) {
          setMemories((prev) => prev.filter((m) => m.id !== id))
          flashToast("J'oublie ça")
        } else {
          flashToast(KABOU_TOASTS.oops)
        }
      } finally {
        setDeletingMemory(null)
      }
    },
    [flashToast],
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Je rassemble ce que je sais de toi…
        </div>
      </div>
    )
  }

  const summaryText = stringifySummary(profile?.businessContext ?? null)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour à l'accueil
        </Link>
      </div>

      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Brain className="h-3 w-3" /> Ma mémoire avec Kabou
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ce que Kabou a retenu de toi
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tout est visible et modifiable. Plus tu m'apprends, plus mes propositions te ressemblent.
        </p>
        <Link
          href="/mon-univers/arche"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
        >
          <Waypoints className="h-3.5 w-3.5" />
          Voir ton arche narrative sur 3 mois
        </Link>
      </header>

      {/* Section — Ton activité */}
      <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            📊 Ton activité
          </h2>
        </div>
        {summaryText ? (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {summaryText}
          </pre>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            Kabou ne connaît pas encore ton activité. Discute avec lui dans le chat pour
            qu'il puisse t'aider mieux.
          </p>
        )}
      </section>

      {/* Section — Tes domaines */}
      <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            🎯 Tes domaines
          </h2>
          {editingField !== 'pillars' && (
            <button
              type="button"
              onClick={() => {
                setEditingField('pillars')
                setDrafts({ editorialPillars: profile?.editorialPillars ?? [] })
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" /> Éditer
            </button>
          )}
        </div>
        {editingField !== 'pillars' ? (
          profile?.editorialPillars && profile.editorialPillars.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.editorialPillars.map((p, i) => (
                <span
                  key={`${p}-${i}`}
                  className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
                >
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Pas encore de domaines définis. Kabou les construira avec toi en te posant
              des questions.
            </p>
          )
        ) : (
          <div>
            <textarea
              value={(drafts.editorialPillars ?? []).join('\n')}
              onChange={(e) =>
                setDrafts({
                  editorialPillars: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={4}
              placeholder="Un domaine par ligne (ex: validation produit, recrutement tech, levée)"
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
            />
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  const ok = await savePatch({
                    editorialPillars: drafts.editorialPillars,
                  } as Partial<Profile>)
                  if (ok) setEditingField(null)
                }}
              >
                <Check className="h-3 w-3" /> Sauvegarder
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingField(null)
                  setDrafts({})
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
        {profile?.editorialTone && (
          <p className="mt-4 text-xs text-muted-foreground">
            Ton habituel : <span className="text-foreground">{profile.editorialTone}</span>
          </p>
        )}
        {profile?.targetFrequency != null && (
          <p className="mt-1 text-xs text-muted-foreground">
            Cadence visée :{' '}
            <span className="text-foreground">{profile.targetFrequency} / semaine</span>
          </p>
        )}
        {profile?.targetPlatforms && profile.targetPlatforms.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Plateformes :{' '}
            <span className="text-foreground">{profile.targetPlatforms.join(', ')}</span>
          </p>
        )}
      </section>

      {/* Section — Ton style */}
      <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            🗣️ Ton style
          </h2>
          {editingField !== 'style' && (
            <button
              type="button"
              onClick={() => {
                setEditingField('style')
                setDrafts({ communicationStyle: profile?.communicationStyle ?? '' })
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" /> Éditer
            </button>
          )}
        </div>
        {editingField !== 'style' ? (
          profile?.communicationStyle ? (
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {profile.communicationStyle}
            </pre>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Kabou apprend ton style au fur et à mesure que tu enregistres des vidéos —
              il reprendra tes tournures et ton lexique dans ses propositions.
            </p>
          )
        ) : (
          <div>
            <textarea
              value={drafts.communicationStyle ?? ''}
              onChange={(e) => setDrafts({ communicationStyle: e.target.value })}
              rows={5}
              placeholder="Comment tu parles habituellement ? (Kabou complète aussi ça tout seul après chaque tournage)"
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
            />
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  const ok = await savePatch({
                    communicationStyle: drafts.communicationStyle ?? null,
                  })
                  if (ok) setEditingField(null)
                }}
              >
                <Check className="h-3 w-3" /> Sauvegarder
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingField(null)
                  setDrafts({})
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Section — Tes sources */}
      <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
        <h2 className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          📚 Tes sources
        </h2>
        <ul className="space-y-2 text-sm">
          {profile?.linkedinUrl && (
            <li className="flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="text-foreground hover:underline"
              >
                LinkedIn
              </a>
              {profile.linkedinIngestedAt && (
                <span className="text-xs text-muted-foreground">
                  · ingéré le {formatDate(profile.linkedinIngestedAt)}
                </span>
              )}
            </li>
          )}
          {profile?.websiteUrl && (
            <li className="flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-foreground hover:underline"
              >
                {profile.websiteUrl}
              </a>
              {profile.websiteIngestedAt && (
                <span className="text-xs text-muted-foreground">
                  · ingéré le {formatDate(profile.websiteIngestedAt)}
                </span>
              )}
            </li>
          )}
          {!profile?.linkedinUrl && !profile?.websiteUrl && (
            <li className="text-sm italic text-muted-foreground">
              Aucune source ingérée pour le moment — l'onboarding Kabou peut en ajouter.
            </li>
          )}
        </ul>
      </section>

      {/* Section — Sujets explorés */}
      {profile?.topicsExplored && profile.topicsExplored.length > 0 && (
        <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
          <h2 className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            🗂️ Sujets déjà explorés
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.topicsExplored.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="rounded-full bg-surface-raised/60 px-2.5 py-1 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Section — Souvenirs RAG */}
      <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Souvenirs ({memories.length})
          </h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Extraits sauvegardés depuis tes tournages, documents et conversations — utilisés
          par Kabou pour personnaliser ses propositions.
        </p>
        {memories.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            Aucun souvenir pour l'instant. Ils apparaîtront après tes premiers tournages.
          </p>
        ) : (
          <ul className="space-y-2">
            {memories.map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded-xl border border-border/30 bg-background/40 p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">{m.content}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(m.createdAt)}</span>
                    {m.tags.slice(0, 3).map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="rounded-full bg-surface-raised/70 px-1.5 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMemory(m.id)}
                  disabled={deletingMemory === m.id}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  title="Oublier ce souvenir"
                >
                  {deletingMemory === m.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border/40 bg-card px-4 py-2 text-xs shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
