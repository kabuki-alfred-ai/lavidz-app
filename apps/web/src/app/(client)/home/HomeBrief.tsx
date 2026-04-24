'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Film,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  Sparkles,
  Waypoints,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type NextStep =
  | { kind: 'publish'; label: string; href: string; topicName: string }
  | { kind: 'record'; label: string; href: string; topicName: string }
  | { kind: 'prepare_recording'; label: string; href: string; topicName: string }
  | { kind: 'continue_exploring'; label: string; href: string; topicName: string }
  | { kind: 'seed_exploration'; label: string; href: string; topicName: string }
  | { kind: 'first_subject'; label: string; href: string; topicName?: string }

type HomeState = {
  userName: string
  thesis: { statement: string; confidence: 'forming' | 'emerging' | 'crystallized'; audienceArchetype: string | null } | null
  hasProfile: boolean
  nextStep: NextStep
  counts: Record<'SEED' | 'EXPLORING' | 'MATURE' | 'ARCHIVED', number>
  totalActiveSubjects: number
  publishedTotal: number
  lastActivityAt: string | null
}

const STEP_ICON: Record<NextStep['kind'], typeof Mic> = {
  publish: Film,
  record: Mic,
  prepare_recording: Sparkles,
  continue_exploring: MessageSquare,
  seed_exploration: Sparkles,
  first_subject: Sparkles,
}

const STEP_HINT: Record<NextStep['kind'], string> = {
  publish: 'Un contenu est prêt — reste plus qu\'à le mettre en ligne.',
  record: 'Tu as une session prête à tourner.',
  prepare_recording: 'Un Sujet est mûr — prépare-le pour le tournage.',
  continue_exploring: 'Un Sujet prend forme — continue à le creuser.',
  seed_exploration: 'Une graine attend d\'être explorée.',
  first_subject: 'Démarre ton premier Sujet — dis-moi sur quoi tu veux parler.',
}

const CONFIDENCE_META: Record<
  NonNullable<HomeState['thesis']>['confidence'],
  { label: string; tone: string }
> = {
  forming: { label: 'en formation', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  emerging: { label: 'qui émerge', tone: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  crystallized: { label: 'cristallisée', tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
}

const FIRST_SUBJECT_PROMPTS = [
  'Ce qui frustre mes clients en ce moment',
  'Mon meilleur apprentissage récent',
  'Une idée reçue fausse dans mon secteur',
]

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Bonsoir'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bel après-midi'
  return 'Bonsoir'
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "aujourd'hui"
  if (diffDays === 1) return 'hier'
  if (diffDays < 7) return `il y a ${diffDays} jours`
  if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} semaines`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function CountTile({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <div className="rounded-2xl border border-border/50 bg-surface-raised/30 p-4 transition hover:bg-surface-raised/50">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export function HomeBrief() {
  const [state, setState] = useState<HomeState | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/home/state', { credentials: 'include', cache: 'no-store' })
      if (res.ok) setState(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  const contextLine = useMemo(() => {
    if (!state) return ''
    const bits: string[] = []
    if (state.counts.EXPLORING > 0) {
      bits.push(`${state.counts.EXPLORING} Sujet${state.counts.EXPLORING > 1 ? 's' : ''} en exploration`)
    }
    if (state.counts.MATURE > 0) {
      const n = state.counts.MATURE
      bits.push(`${n} prêt${n > 1 ? 's' : ''} à tourner`)
    }
    if (bits.length === 0) return 'Tu pars d\'une page blanche — c\'est un bon point de départ.'
    return `Tu as ${bits.slice(0, 2).join(', ')}.`
  }, [state])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:py-12">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-44 animate-pulse rounded-3xl bg-muted" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm italic text-muted-foreground">Home indisponible pour le moment.</p>
      </div>
    )
  }

  const Icon = STEP_ICON[state.nextStep.kind]
  const topicName = 'topicName' in state.nextStep ? state.nextStep.topicName : null
  const confidence = state.thesis?.confidence
  const isFirstSubject = state.nextStep.kind === 'first_subject'

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:py-12">

      {/* Greeting */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {getGreeting()} {state.userName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {state.lastActivityAt && ` · dernière activité ${formatRelativeDate(state.lastActivityAt)}`}
        </p>
      </header>

      {/* Thesis banner */}
      {state.thesis ? (
        <Link
          href="/mon-univers/these"
          className="block rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 transition hover:bg-primary/10"
        >
          <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-primary">
            <Waypoints className="h-3 w-3" /> Ta thèse
            {confidence && (
              <span className={`ml-auto inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal ${CONFIDENCE_META[confidence].tone}`}>
                {CONFIDENCE_META[confidence].label}
              </span>
            )}
          </div>
          <p className="text-sm italic text-foreground">&laquo;&nbsp;{state.thesis.statement}&nbsp;&raquo;</p>
        </Link>
      ) : (
        <Link
          href="/mon-univers/these"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <Waypoints className="h-3.5 w-3.5" />
          Tu n'as pas encore de thèse — Kabou peut t'aider à la formuler.
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}

      {/* Next step — dominant tile */}
      <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
          🎯 Ton prochain pas
        </p>
        {!isFirstSubject && (
          <p className="mb-4 text-sm text-muted-foreground">{contextLine}</p>
        )}
        <p className="mb-5 text-base leading-snug text-foreground sm:text-lg">
          {STEP_HINT[state.nextStep.kind]}
        </p>
        {topicName && (
          <p className="mb-5 text-sm font-semibold text-foreground">
            &laquo;&nbsp;{topicName}&nbsp;&raquo;
          </p>
        )}
        <Button asChild size="lg">
          <Link href={state.nextStep.href}>
            <Icon className="h-4 w-4" />
            {state.nextStep.label}
          </Link>
        </Button>

        {/* Prompts rapides pour le premier sujet */}
        {isFirstSubject && (
          <div className="mt-6 flex flex-wrap gap-2">
            {FIRST_SUBJECT_PROMPTS.map((prompt) => (
              <Link
                key={prompt}
                href={`/chat?topic=${encodeURIComponent(prompt)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <Sparkles className="h-3 w-3 text-primary" />
                {prompt}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Counts */}
      {state.totalActiveSubjects > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          <CountTile
            label="En exploration"
            value={state.counts.SEED + state.counts.EXPLORING}
            href="/topics?filter=draft"
          />
          <CountTile
            label="Prêts à tourner"
            value={state.counts.MATURE}
            href="/topics?filter=ready"
          />
          <CountTile
            label="Publiés"
            value={state.publishedTotal}
            href="/mon-univers/arche"
          />
        </section>
      )}

      {/* Nouveau sujet — accès discret pour users actifs */}
      {!isFirstSubject && (
        <div className="flex justify-center pt-2">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouveau sujet
          </Link>
        </div>
      )}

    </div>
  )
}
