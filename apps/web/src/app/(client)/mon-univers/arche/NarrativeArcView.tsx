'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarRange,
  Compass,
  Eye,
  FileText,
  Loader2,
  Sparkles,
  TrendingUp,
  Waypoints,
} from 'lucide-react'
import { FORMAT_CONFIGS, type ContentFormat } from '@lavidz/types'

type Observations = {
  headline: string
  recurringThemes: string[]
  unexploredAngles: string[]
  evolutionMarkers: string[]
  coherence: 'dispersé' | 'cohérent' | 'en train de s’affirmer' | 'ciblé'
}

type Stats = {
  windowDays: number
  since: string
  until: string
  topicsTotal: number
  sessionsTotal: number
  publishedTotal: number
  activeWeeks: number
  pillarsVolume: Array<{ pillar: string; count: number }>
  formatsVolume: Array<{ format: string; count: number }>
  weeklyTimeline: Array<{ weekStart: string; tournages: number }>
}

type NarrativeArcResult = {
  stats: Stats
  observations: Observations | null
  empty: boolean
}

const COHERENCE_META: Record<
  Observations['coherence'],
  { label: string; tone: string }
> = {
  dispersé: {
    label: 'Dispersé',
    tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  cohérent: {
    label: 'Cohérent',
    tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  'en train de s’affirmer': {
    label: 'En train de s’affirmer',
    tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  ciblé: {
    label: 'Ciblé',
    tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  },
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof Eye
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-surface-raised/30 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

function HorizontalBar({
  label,
  count,
  max,
  tone,
}: {
  label: string
  count: number
  max: number
  tone: string
}) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="truncate font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Sparkline({ data }: { data: Array<{ weekStart: string; tournages: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.tournages))
  return (
    <div className="flex h-16 items-end gap-1">
      {data.map((d) => {
        const pct = Math.round((d.tournages / max) * 100)
        const label = new Date(d.weekStart).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
        })
        return (
          <div
            key={d.weekStart}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={`${label} : ${d.tournages} tournage${d.tournages > 1 ? 's' : ''}`}
          >
            <div
              className={`w-full rounded-t transition-colors ${
                d.tournages > 0 ? 'bg-primary/70 group-hover:bg-primary' : 'bg-muted/40'
              }`}
              style={{ height: `${Math.max(6, pct)}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}

export function NarrativeArcView() {
  const [result, setResult] = useState<NarrativeArcResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/narrative-arc', {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!alive) return
        if (!res.ok) {
          setError('Arche narrative indisponible pour le moment.')
          return
        }
        const data = (await res.json()) as NarrativeArcResult
        setResult(data)
      } catch {
        if (alive) setError('Arche narrative indisponible pour le moment.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-5xl flex-col items-center justify-center gap-3 px-4 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Lecture de ton arche…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-5xl flex-col items-center justify-center gap-3 px-4 py-8 text-center text-sm italic text-muted-foreground">
        {error}
      </div>
    )
  }

  if (!result) return null

  const { stats, observations, empty } = result
  const maxPillar = Math.max(1, ...stats.pillarsVolume.map((p) => p.count))
  const maxFormat = Math.max(1, ...stats.formatsVolume.map((f) => f.count))

  const sinceLabel = new Date(stats.since).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
  const untilLabel = new Date(stats.until).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-5">
        <Link
          href="/mon-univers/memoire"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Mon univers
        </Link>
      </div>

      <header className="mb-6">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Waypoints className="h-3 w-3" /> Arche narrative
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {stats.windowDays} derniers jours
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sinceLabel} → {untilLabel}
        </p>
      </header>

      {empty ? (
        <div className="rounded-2xl border border-border/50 bg-surface-raised/30 p-8 text-center text-sm italic text-muted-foreground">
          Pas encore assez de matière pour lire ton arche. Reviens après quelques tournages et quelques
          Sujets — on aura du grain à moudre.
        </div>
      ) : (
        <>
          <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Sujets" value={stats.topicsTotal} icon={FileText} />
            <StatCard label="Tournages" value={stats.sessionsTotal} icon={Eye} />
            <StatCard label="Publiés" value={stats.publishedTotal} icon={Sparkles} />
            <StatCard
              label="Semaines actives"
              value={`${stats.activeWeeks}/12`}
              icon={CalendarRange}
            />
          </section>

          {observations && (
            <section className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  <Sparkles className="h-3 w-3" /> Lecture de Kabou
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COHERENCE_META[observations.coherence].tone}`}
                >
                  {COHERENCE_META[observations.coherence].label}
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed text-foreground">
                {observations.headline}
              </p>

              {observations.recurringThemes.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <TrendingUp className="h-3 w-3" /> Ce qui revient
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {observations.recurringThemes.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-muted-foreground/50">·</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {observations.evolutionMarkers.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    <Sparkles className="h-3 w-3" /> Ce qui s'affirme
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {observations.evolutionMarkers.map((m, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-emerald-500/60">·</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {observations.unexploredAngles.length > 0 && (
                <div className="mt-5 border-t border-border/30 pt-4">
                  <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Compass className="h-3 w-3" /> Angles peu couverts
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {observations.unexploredAngles.map((a, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-muted-foreground/50">·</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section className="mb-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
              <h3 className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Domaines
              </h3>
              {stats.pillarsVolume.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">Aucun domaine travaillé sur la période.</p>
              ) : (
                <div className="space-y-3">
                  {stats.pillarsVolume.slice(0, 8).map((p) => (
                    <HorizontalBar
                      key={p.pillar}
                      label={p.pillar}
                      count={p.count}
                      max={maxPillar}
                      tone="bg-primary/70"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
              <h3 className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Formats
              </h3>
              {stats.formatsVolume.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">Aucun tournage sur la période.</p>
              ) : (
                <div className="space-y-3">
                  {stats.formatsVolume.map((f) => {
                    const cfg = FORMAT_CONFIGS[f.format as ContentFormat]
                    return (
                      <HorizontalBar
                        key={f.format}
                        label={`${cfg?.icon ?? ''} ${cfg?.label ?? f.format}`.trim()}
                        count={f.count}
                        max={maxFormat}
                        tone="bg-violet-500/70"
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
            <h3 className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Cadence (12 dernières semaines)
            </h3>
            <Sparkline data={stats.weeklyTimeline} />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground/60">
              <span>
                {stats.weeklyTimeline[0]
                  ? new Date(stats.weeklyTimeline[0].weekStart).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : ''}
              </span>
              <span>
                {stats.weeklyTimeline[stats.weeklyTimeline.length - 1]
                  ? new Date(
                      stats.weeklyTimeline[stats.weeklyTimeline.length - 1].weekStart,
                    ).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                  : ''}
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
