'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Waypoints,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Confidence = 'forming' | 'emerging' | 'crystallized'

type Thesis = {
  statement: string
  enemies: string[]
  audienceArchetype: string
  confidence: Confidence
  updatedAt: string
}

type Proposal = {
  statement: string
  enemies: string[]
  audienceArchetype: string
}

const CONFIDENCE_META: Record<Confidence, { label: string; tone: string; description: string }> = {
  forming: {
    label: 'En formation',
    tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    description: 'Tu viens de la poser. Elle va se préciser avec tes prochains Sujets.',
  },
  emerging: {
    label: 'Qui émerge',
    tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    description: 'Elle gagne en netteté au fil de tes contenus.',
  },
  crystallized: {
    label: 'Cristallisée',
    tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    description: 'Tu l\'as raffinée plusieurs fois. Elle tient maintenant.',
  },
}

export function ThesisView() {
  const [thesis, setThesis] = useState<Thesis | null>(null)
  const [loading, setLoading] = useState(true)
  const [proposing, setProposing] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Proposal>({ statement: '', enemies: [], audienceArchetype: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/thesis', { credentials: 'include', cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as Thesis | null
          setThesis(data)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handlePropose = useCallback(async () => {
    setProposing(true)
    try {
      const res = await fetch('/api/thesis/propose', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        flash('Kabou ne parvient pas à proposer une thèse pour l\'instant.')
        return
      }
      const data = (await res.json()) as Proposal
      setProposal(data)
      setDraft(data)
    } finally {
      setProposing(false)
    }
  }, [flash])

  const handleSave = useCallback(
    async (payload: Proposal) => {
      setSaving(true)
      try {
        const res = await fetch('/api/thesis', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          flash('Sauvegarde impossible.')
          return
        }
        const saved = (await res.json()) as Thesis
        setThesis(saved)
        setProposal(null)
        setEditing(false)
        flash('Thèse enregistrée.')
      } finally {
        setSaving(false)
      }
    },
    [flash],
  )

  const handleClear = useCallback(async () => {
    if (!confirm('Retirer ta thèse actuelle ?')) return
    setSaving(true)
    try {
      await fetch('/api/thesis', { method: 'DELETE', credentials: 'include' })
      setThesis(null)
      flash('Thèse retirée.')
    } finally {
      setSaving(false)
    }
  }, [flash])

  const startEdit = useCallback(() => {
    if (!thesis) return
    setDraft({
      statement: thesis.statement,
      enemies: thesis.enemies.length ? thesis.enemies : [''],
      audienceArchetype: thesis.audienceArchetype,
    })
    setEditing(true)
  }, [thesis])

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Chargement de ta thèse…</span>
      </div>
    )
  }

  const isEmpty = !thesis && !proposal
  const showEditor = proposal || editing

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-5">
        <Link
          href="/mon-univers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Mon univers
        </Link>
      </div>

      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Waypoints className="h-3 w-3" /> Ta thèse
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">La phrase qu'on retient de toi</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Ta thèse, c'est la conviction forte qui oriente tout ce que tu dis publiquement. Elle tient en
          une phrase de 15 mots, elle se défend, elle refuse un consensus. Kabou s'y adosse pour te
          proposer des Sujets cohérents.
        </p>
      </header>

      {/* Empty state with soft onboarding */}
      {isEmpty && !showEditor && (
        <section className="rounded-2xl border border-border/50 bg-surface-raised/30 p-6">
          <p className="mb-4 text-sm leading-relaxed text-foreground/90">
            Tu n'as pas encore posé ta thèse. Je peux t'en proposer une brouillon à partir de ce que j'ai
            compris de toi et des Sujets que tu as déjà travaillés. Tu pourras la raffiner ensuite.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePropose} disabled={proposing}>
              {proposing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Propose-moi une thèse
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDraft({ statement: '', enemies: [''], audienceArchetype: '' })
                setEditing(true)
              }}
              disabled={proposing}
            >
              <Pencil className="h-4 w-4" />
              Je l'écris moi-même
            </Button>
          </div>
        </section>
      )}

      {/* Existing thesis — display */}
      {thesis && !showEditor && (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CONFIDENCE_META[thesis.confidence].tone}`}
            >
              {CONFIDENCE_META[thesis.confidence].label}
            </span>
            <span className="text-xs text-muted-foreground">
              {CONFIDENCE_META[thesis.confidence].description}
            </span>
          </div>
          <blockquote className="mb-6 text-xl font-semibold leading-snug text-foreground">
            &laquo;&nbsp;{thesis.statement}&nbsp;&raquo;
          </blockquote>

          {thesis.audienceArchetype && (
            <div className="mb-5">
              <h3 className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                Pour qui
              </h3>
              <p className="text-sm italic">{thesis.audienceArchetype}</p>
            </div>
          )}

          {thesis.enemies.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                Contre quelles idées reçues
              </h3>
              <ul className="space-y-1 text-sm">
                {thesis.enemies.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-rose-500/70">✕</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Raffiner
            </Button>
            <Button size="sm" variant="outline" onClick={handlePropose} disabled={proposing}>
              {proposing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Nouvelle proposition Kabou
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClear} disabled={saving}>
              <Trash2 className="h-3.5 w-3.5" />
              Retirer
            </Button>
          </div>
        </section>
      )}

      {/* Editor (proposal or manual edit) */}
      {showEditor && (
        <section className="rounded-2xl border border-border/50 bg-surface-raised/30 p-6">
          {proposal && (
            <div className="mb-4 rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary">
              Kabou te propose cette thèse. Ajuste-la avant de la valider.
            </div>
          )}

          <label className="mb-5 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Ta phrase-clé (15 mots max)
            </span>
            <textarea
              value={draft.statement}
              onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
              rows={3}
              placeholder="Je pense que... / Je refuse... / Je défends..."
              className="w-full resize-y rounded-lg border border-border/40 bg-background px-3 py-2 text-base leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              À qui tu t'adresses (archétype précis)
            </span>
            <input
              type="text"
              value={draft.audienceArchetype}
              onChange={(e) => setDraft({ ...draft, audienceArchetype: e.target.value })}
              placeholder="Ex: le dirigeant PME qui a peur de manquer le train IA mais refuse de licencier"
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </label>

          <div className="mb-5">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Contre quelles idées reçues (1-3)
            </span>
            <div className="space-y-2">
              {(draft.enemies.length ? draft.enemies : ['']).map((enemy, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={enemy}
                    onChange={(e) => {
                      const next = [...draft.enemies]
                      next[i] = e.target.value
                      setDraft({ ...draft, enemies: next })
                    }}
                    placeholder="Une idée reçue que tu combats"
                    className="flex-1 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  {(draft.enemies.length ?? 0) > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = draft.enemies.filter((_, idx) => idx !== i)
                        setDraft({ ...draft, enemies: next })
                      }}
                      className="px-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {(draft.enemies.length ?? 0) < 3 && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, enemies: [...draft.enemies, ''] })}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  + Ajouter
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                handleSave({
                  statement: draft.statement.trim(),
                  enemies: draft.enemies.map((e) => e.trim()).filter(Boolean),
                  audienceArchetype: draft.audienceArchetype.trim(),
                })
              }
              disabled={saving || draft.statement.trim().length < 10}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Enregistrer ma thèse
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setProposal(null)
                setEditing(false)
              }}
              disabled={saving}
            >
              Annuler
            </Button>
          </div>
        </section>
      )}

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
