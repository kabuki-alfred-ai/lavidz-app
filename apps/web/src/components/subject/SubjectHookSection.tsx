'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type HookVariant = {
  phrase: string
  reason: string
}

type StoredHooks = {
  native: HookVariant
  marketing: HookVariant
  chosen?: 'native' | 'marketing' | null
  generatedAt: string
}

interface SubjectHookSectionProps {
  topicId: string
  hasBrief: boolean
  onFlashToast: (message: string) => void
}

type Kind = 'native' | 'marketing'

const KIND_META: Record<
  Kind,
  { title: string; badge: string; badgeTone: string; description: string }
> = {
  native: {
    title: 'Ta voix',
    badge: 'native',
    badgeTone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    description: 'Comme tu le dirais à un pote. Reconnaissable, humain.',
  },
  marketing: {
    title: 'Version scroll',
    badge: 'marketing',
    badgeTone: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
    description: 'Plus punchy, pour retenir le pouce dans 0,5s.',
  },
}

export function SubjectHookSection({
  topicId,
  hasBrief,
  onFlashToast,
}: SubjectHookSectionProps) {
  const [hooks, setHooks] = useState<StoredHooks | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingChoice, setSavingChoice] = useState<Kind | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/topics/${topicId}/hooks`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!alive) return
        if (res.ok) {
          const data = (await res.json()) as StoredHooks | null
          setHooks(data)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [topicId])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/hooks`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        onFlashToast("Impossible de proposer des accroches pour l'instant.")
        return
      }
      const data = (await res.json()) as StoredHooks
      setHooks(data)
    } finally {
      setGenerating(false)
    }
  }, [topicId, onFlashToast])

  const handleChoose = useCallback(
    async (kind: Kind) => {
      if (!hooks) return
      const next = hooks.chosen === kind ? null : kind
      setSavingChoice(kind)
      try {
        const res = await fetch(`/api/topics/${topicId}/hooks`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chosen: next }),
        })
        if (!res.ok) {
          onFlashToast('Choix non enregistré.')
          return
        }
        const data = (await res.json()) as StoredHooks | null
        if (data) setHooks(data)
        else setHooks({ ...hooks, chosen: next })
        onFlashToast(next ? 'Accroche choisie.' : 'Choix retiré.')
      } finally {
        setSavingChoice(null)
      }
    },
    [hooks, topicId, onFlashToast],
  )

  const handleCopy = useCallback(
    async (phrase: string) => {
      try {
        await navigator.clipboard.writeText(phrase)
        onFlashToast('Accroche copiée.')
      } catch {
        onFlashToast('Copie impossible.')
      }
    },
    [onFlashToast],
  )

  if (loading) return null

  return (
    <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Accroche
        </h2>
        {hooks && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs"
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Reformuler
          </Button>
        )}
      </div>

      {!hooks && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Kabou te propose deux versions de ton accroche : ta voix à toi, et une version plus
            scroll-stopping. Tu choisis celle qui te ressemble.
          </p>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating || !hasBrief}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Proposer deux accroches
          </Button>
          {!hasBrief && (
            <p className="text-xs italic text-muted-foreground">
              Travaille d'abord un angle pour avoir des accroches ancrées.
            </p>
          )}
        </div>
      )}

      {hooks && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(['native', 'marketing'] as Kind[]).map((kind) => {
            const variant = hooks[kind]
            const meta = KIND_META[kind]
            const isChosen = hooks.chosen === kind
            return (
              <article
                key={kind}
                className={`flex flex-col rounded-xl border p-4 transition ${
                  isChosen
                    ? 'border-primary bg-primary/5'
                    : 'border-border/40 bg-background/40 hover:bg-background/60'
                }`}
              >
                <header className="mb-2 flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.badgeTone}`}
                  >
                    {meta.badge}
                  </span>
                  <span className="text-xs font-medium">{meta.title}</span>
                </header>
                <blockquote className="mb-3 text-base font-semibold leading-snug text-foreground">
                  &laquo;&nbsp;{variant.phrase}&nbsp;&raquo;
                </blockquote>
                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  {meta.description}
                </p>
                {variant.reason && (
                  <p className="mb-4 border-l-2 border-border/50 pl-2 text-xs italic text-muted-foreground">
                    {variant.reason}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={isChosen ? 'default' : 'outline'}
                    onClick={() => handleChoose(kind)}
                    disabled={savingChoice === kind}
                    className="text-xs"
                  >
                    {savingChoice === kind ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isChosen ? (
                      <X className="h-3 w-3" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    {isChosen ? 'Retirer' : 'Choisir'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(variant.phrase)}
                    className="text-xs"
                  >
                    Copier
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
