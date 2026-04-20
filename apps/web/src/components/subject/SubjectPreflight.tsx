'use client'

import { useCallback, useState } from 'react'
import { CheckCircle2, Loader2, PlaneTakeoff, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Strength = 'strong' | 'medium' | 'weak'

type FilterResult = {
  strength: Strength
  observation: string
  suggestion: string | null
}

type PreflightResult = {
  hook: FilterResult
  proof: FilterResult
  takeaway: FilterResult
  overallVerdict: 'ready' | 'refine_recommended' | 'refine_required'
}

const STRENGTH_META: Record<Strength, { label: string; tone: string; dotColor: string }> = {
  strong: {
    label: 'Solide',
    tone: 'text-emerald-700 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  medium: {
    label: 'À muscler',
    tone: 'text-amber-700 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
  weak: {
    label: 'Manque',
    tone: 'text-rose-700 dark:text-rose-400',
    dotColor: 'bg-rose-500',
  },
}

const FILTER_LABEL: Record<'hook' | 'proof' | 'takeaway', { title: string; subtitle: string }> = {
  hook: { title: 'Accroche', subtitle: 'Arrête-t-il le scroll ?' },
  proof: { title: 'Preuve', subtitle: 'Y a-t-il un ancrage concret ?' },
  takeaway: { title: 'Pensée qui reste', subtitle: 'Que retient le lecteur ?' },
}

interface SubjectPreflightProps {
  topicId: string
}

/**
 * Non-blocking pre-flight check shown on a Sujet juste before tournage.
 * Runs 3 filters (hook / proof / takeaway) via Kabou. The CTA to launch
 * tournage stays available regardless of verdict — this is a coach filter,
 * not a gate.
 */
export function SubjectPreflight({ topicId }: SubjectPreflightProps) {
  const [result, setResult] = useState<PreflightResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/preflight`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        setError('Kabou ne peut pas faire le check pour l\'instant.')
        return
      }
      const data = (await res.json()) as PreflightResult
      setResult(data)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  return (
    <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <PlaneTakeoff className="h-3.5 w-3.5" />
          Pré-tournage
        </h2>
      </div>

      {!result && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Avant de tourner, Kabou peut passer ton Sujet au crible en 3 points : accroche, preuve, pensée
            qui reste. Non bloquant — tu décides.
          </p>
          <Button size="sm" onClick={handleRun} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlaneTakeoff className="h-3.5 w-3.5" />}
            Lancer le check Kabou
          </Button>
          {error && <p className="text-xs italic text-rose-500">{error}</p>}
        </div>
      )}

      {result && (
        <>
          <div
            className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              result.overallVerdict === 'ready'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : result.overallVerdict === 'refine_recommended'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
            }`}
          >
            {result.overallVerdict === 'ready' ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <TriangleAlert className="h-3.5 w-3.5" />
            )}
            {result.overallVerdict === 'ready'
              ? 'Tu es prête à tourner'
              : result.overallVerdict === 'refine_recommended'
                ? 'Tu peux tourner, mais 2 min de muscu aideraient'
                : 'Une brique structurelle manque — envisage de retravailler'}
          </div>

          <ul className="space-y-4">
            {(['hook', 'proof', 'takeaway'] as const).map((key) => {
              const entry = result[key]
              const meta = STRENGTH_META[entry.strength]
              const label = FILTER_LABEL[key]
              return (
                <li key={key} className="rounded-xl border border-border/40 bg-background/40 p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${meta.dotColor}`} />
                    <span className="text-sm font-semibold">{label.title}</span>
                    <span className={`text-[11px] uppercase tracking-wider ${meta.tone}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="mb-1.5 text-xs text-muted-foreground">{label.subtitle}</p>
                  <p className="mb-2 text-sm leading-relaxed">{entry.observation}</p>
                  {entry.suggestion && (
                    <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs italic text-foreground/80">
                      💡 {entry.suggestion}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={handleRun} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlaneTakeoff className="h-3.5 w-3.5" />}
              Relancer le check
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
