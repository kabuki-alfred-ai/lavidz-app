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
import { HomeKabouEntry } from './HomeKabouEntry'

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
    <div className="rounded-2xl bg-surface p-5 min-h-[88px] flex flex-col justify-between transition hover:bg-surface-raised/50 active:scale-[0.98]">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-3xl font-bold text-foreground leading-none">{value}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export function HomeBrief() {
  const [state, setState] = useState<HomeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [showKabouEntry, setShowKabouEntry] = useState(false)

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
        <div className="flex items-start justify-between">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted md:hidden" />
        </div>
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
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {getGreeting()} {state.userName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {state.lastActivityAt && ` · dernière activité ${formatRelativeDate(state.lastActivityAt)}`}
          </p>
        </div>

        {/* Avatar — mobile only, links to /moi */}
        <Link
          href="/moi"
          aria-label="Mon profil"
          className="md:hidden shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary hover:bg-primary/20 transition-colors active:scale-95"
        >
          {state.userName[0]?.toUpperCase() ?? '?'}
        </Link>
      </header>

      {/* Mon Univers */}
      <Link
        href="/mon-univers"
        className="group block rounded-2xl bg-surface px-5 py-5 transition-colors hover:bg-surface-raised/60 active:scale-[0.99] min-h-[80px]"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Waypoints className="h-3.5 w-3.5" />
            Mon Univers
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
        </div>

        {state.thesis ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm italic leading-snug text-foreground">
                &laquo;&nbsp;{state.thesis.statement}&nbsp;&raquo;
              </p>
              {confidence && (
                <span className={`shrink-0 mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_META[confidence].tone}`}>
                  {CONFIDENCE_META[confidence].label}
                </span>
              )}
            </div>
            {state.thesis.audienceArchetype && (
              <p className="text-xs text-muted-foreground">
                Pour&nbsp;<span className="font-medium text-foreground">{state.thesis.audienceArchetype}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Kabou te connaît peu pour l'instant</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Définis ta thèse et tes piliers — ses propositions seront bien plus précises.
              </p>
            </div>
          </div>
        )}
      </Link>

      {/* Next step — dominant tile */}
      <section className="rounded-3xl bg-primary/8 p-6 sm:p-8">
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
                className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-4 py-3 text-sm text-muted-foreground transition hover:text-foreground active:scale-95 min-h-[44px]"
              >
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
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

      {/* Nouvelle vidéo — CTA visible pour users actifs */}
      {!isFirstSubject && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setShowKabouEntry(true)}
            className="inline-flex items-center gap-2.5 rounded-full bg-surface px-6 py-3.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground active:scale-95 min-h-[52px]"
          >
            <Plus className="h-4 w-4" />
            Nouvelle vidéo
          </button>
        </div>
      )}

      {/* Overlay HomeKabouEntry */}
      {showKabouEntry && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <HomeKabouEntry />
        </div>
      )}

    </div>
  )
}
