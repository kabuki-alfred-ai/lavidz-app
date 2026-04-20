'use client'

import { CheckCircle2, Compass, Flame, Sparkles, TrendingUp } from 'lucide-react'

type Invitation = {
  label: string
  why: string
  kind: 'unexplored_format' | 'unexplored_domain' | 'deepen_pattern' | 'break_routine'
}

export type WeeklyReviewPayload =
  | {
      empty: true
      message: string
    }
  | {
      empty?: false
      headline: string
      patterns: string[]
      strengths: string[]
      nextInvitations: Invitation[]
      period?: { start: string; end: string }
      tournagesCount: number
      topicsCount: number
    }

const KIND_META: Record<Invitation['kind'], { emoji: string; tone: string }> = {
  unexplored_format: { emoji: '🎨', tone: 'bg-violet-500/10 text-violet-600' },
  unexplored_domain: { emoji: '🌱', tone: 'bg-emerald-500/10 text-emerald-600' },
  deepen_pattern: { emoji: '🔎', tone: 'bg-blue-500/10 text-blue-600' },
  break_routine: { emoji: '⚡', tone: 'bg-orange-500/10 text-orange-600' },
}

export function WeeklyReviewCard({ payload }: { payload: WeeklyReviewPayload }) {
  if (payload.empty) {
    return (
      <div className="my-3 rounded-2xl border border-border/40 bg-surface-raised/30 p-5 text-sm italic text-muted-foreground">
        {payload.message}
      </div>
    )
  }

  return (
    <div className="my-3 rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
        <Flame className="h-3.5 w-3.5" /> Revue de ta semaine
      </div>
      <h3 className="text-sm font-medium leading-snug">{payload.headline}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {payload.tournagesCount} tournage{payload.tournagesCount > 1 ? 's' : ''} ·{' '}
        {payload.topicsCount} sujet{payload.topicsCount > 1 ? 's' : ''} créé
        {payload.topicsCount > 1 ? 's' : ''}
      </p>

      {payload.patterns.length > 0 && (
        <section className="mt-4">
          <h4 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Ce qui revient
          </h4>
          <ul className="space-y-1.5 text-sm">
            {payload.patterns.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground/50">·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payload.strengths.length > 0 && (
        <section className="mt-4">
          <h4 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            <Sparkles className="h-3 w-3" /> Ce qui a bien marché
          </h4>
          <ul className="space-y-1.5 text-sm">
            {payload.strengths.map((s, i) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payload.nextInvitations.length > 0 && (
        <section className="mt-4 border-t border-border/30 pt-4">
          <h4 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Compass className="h-3 w-3" /> Invitations pour la suite
          </h4>
          <ul className="space-y-2">
            {payload.nextInvitations.map((inv, i) => {
              const meta = KIND_META[inv.kind]
              return (
                <li
                  key={i}
                  className="rounded-xl border border-border/40 bg-card p-3"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.tone}`}
                    >
                      {meta.emoji}
                      {inv.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{inv.why}</p>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
