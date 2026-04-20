'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Calendar,
  Check,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Proposal = {
  suggestedDate: string
  format: string
  title: string
  angle: string
  hook: string
  pillar?: string | null
  platforms?: string[]
}

const FORMAT_LABELS: Record<string, string> = {
  QUESTION_BOX: 'Interview',
  TELEPROMPTER: 'Guide',
  HOT_TAKE: 'Réaction',
  STORYTELLING: 'Histoire',
  DAILY_TIP: 'Conseil',
  MYTH_VS_REALITY: 'Mythe vs Réalité',
}

const FORMAT_TONE: Record<string, string> = {
  QUESTION_BOX: 'bg-blue-500/10 text-blue-600',
  TELEPROMPTER: 'bg-violet-500/10 text-violet-600',
  HOT_TAKE: 'bg-orange-500/10 text-orange-600',
  STORYTELLING: 'bg-pink-500/10 text-pink-600',
  DAILY_TIP: 'bg-emerald-500/10 text-emerald-600',
  MYTH_VS_REALITY: 'bg-amber-500/10 text-amber-600',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return iso
  }
}

interface EditorialPlanProposalProps {
  narrativeArc: string
  intentionCaptured?: string
  proposals: Proposal[]
}

type State = 'sculpting' | 'committing' | 'committed' | 'error'

/**
 * Renders a propose_editorial_plan tool result as an interactive preview card.
 * The entrepreneur sculpts the list (keep / drop / tweak) before committing.
 */
export function EditorialPlanProposal({
  narrativeArc,
  intentionCaptured,
  proposals,
}: EditorialPlanProposalProps) {
  const [kept, setKept] = useState<boolean[]>(() => proposals.map(() => true))
  const [drafts, setDrafts] = useState<Proposal[]>(() => proposals.map((p) => ({ ...p })))
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [state, setState] = useState<State>('sculpting')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<{ committed: number } | null>(null)

  const selectedCount = useMemo(() => kept.filter(Boolean).length, [kept])

  const toggleKeep = (i: number) => {
    setKept((prev) => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }

  const updateDraft = (i: number, patch: Partial<Proposal>) => {
    setDrafts((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], ...patch }
      return next
    })
  }

  const handleCommit = async () => {
    if (selectedCount === 0) return
    setState('committing')
    setErrorMsg(null)
    try {
      const body = {
        proposals: drafts.filter((_, i) => kept[i]),
      }
      const res = await fetch('/api/editorial-plan/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        setErrorMsg(text || 'Enregistrement impossible')
        setState('error')
        return
      }
      const data = (await res.json()) as { committed: number }
      setResult(data)
      setState('committed')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  if (state === 'committed' && result) {
    return (
      <div className="my-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium">
            C'est gravé dans ton calendrier — {result.committed} Sujet{result.committed > 1 ? 's' : ''} en Graine.
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          On peut mûrir chacun à ton rythme. Ouvre-les quand tu veux pour les travailler avec moi.
        </p>
        <Button asChild size="sm">
          <Link href="/calendar">
            Voir mon calendrier <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="my-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      {/* Header */}
      <div className="mb-4 border-b border-border/30 pb-4">
        <div className="mb-2 inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Vision éditoriale — proposition
          </span>
        </div>
        {intentionCaptured && (
          <p className="mb-2 text-xs italic text-muted-foreground">
            Ce que j'ai compris : « {intentionCaptured} »
          </p>
        )}
        <p className="text-sm leading-relaxed">
          <span className="font-medium">Fil rouge :</span> {narrativeArc}
        </p>
      </div>

      {/* Proposals list */}
      <ul className="space-y-3">
        {drafts.map((p, i) => {
          const isKept = kept[i]
          const isEditing = editingIndex === i
          return (
            <li
              key={i}
              className={`rounded-xl border p-3 transition ${
                isKept ? 'border-border/40 bg-card' : 'border-border/20 bg-background/20 opacity-50'
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDate(p.suggestedDate)}
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    FORMAT_TONE[p.format] ?? 'bg-muted text-muted-foreground'
                  }`}
                >
                  {FORMAT_LABELS[p.format] ?? p.format}
                </span>
              </div>

              {!isEditing ? (
                <>
                  <p className="text-sm font-medium leading-snug">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.angle}</p>
                  {p.hook && (
                    <p className="mt-2 rounded-md bg-surface-raised/40 px-2 py-1 text-xs italic">
                      Hook : &laquo;&nbsp;{p.hook}&nbsp;&raquo;
                    </p>
                  )}
                  {p.pillar && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-raised/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                      🎯 {p.pillar}
                    </span>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-sm"
                    value={p.title}
                    onChange={(e) => updateDraft(i, { title: e.target.value })}
                    placeholder="Titre du sujet"
                  />
                  <textarea
                    rows={2}
                    className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs"
                    value={p.angle}
                    onChange={(e) => updateDraft(i, { angle: e.target.value })}
                    placeholder="Angle"
                  />
                  <input
                    className="w-full rounded-md border border-border/40 bg-background px-2 py-1 text-xs"
                    value={p.hook}
                    onChange={(e) => updateDraft(i, { hook: e.target.value })}
                    placeholder="Hook"
                  />
                </div>
              )}

              {/* Row actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isKept ? (
                  <>
                    {!isEditing ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingIndex(i)}
                        className="h-7 px-2 text-xs"
                      >
                        <Pencil className="h-3 w-3" /> Reformuler
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingIndex(null)}
                        className="h-7 px-2 text-xs"
                      >
                        <Check className="h-3 w-3" /> OK
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleKeep(i)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Retirer
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleKeep(i)}
                    className="h-7 px-2 text-xs"
                  >
                    <Check className="h-3 w-3" /> Reprendre
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Footer — commit */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-4">
        <p className="text-xs text-muted-foreground">
          {selectedCount === 0
            ? 'Aucune proposition retenue pour le moment'
            : `${selectedCount} Sujet${selectedCount > 1 ? 's' : ''} à valider`}
        </p>
        <div className="flex items-center gap-2">
          {errorMsg && state === 'error' && (
            <span className="text-xs text-destructive">
              <X className="mr-1 inline-block h-3 w-3" /> {errorMsg}
            </span>
          )}
          <Button
            size="sm"
            onClick={handleCommit}
            disabled={selectedCount === 0 || state === 'committing'}
          >
            {state === 'committing' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Valider ces {selectedCount} sujet{selectedCount > 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
