'use client'

import Link from 'next/link'
import { ArrowRight, ExternalLink, Flame, Flower, History, Search } from 'lucide-react'

type WeeklyMomentResult = {
  mode: 'weekly_moment'
  openers: string[]
  recentCapturedSignals: Array<{ kind: 'topic' | 'session'; label: string; daysAgo: number }>
}

type ResurrectSeedResult = {
  mode: 'resurrect_seed'
  picks: Array<{
    topicId: string
    name: string
    pillar: string | null
    why: string
    freshAngle: string
    brief: string | null
  }>
}

type ForgottenDomainResult = {
  mode: 'forgotten_domain'
  domain: string | null
  lastSeenWeeksAgo: number | null
  angles: Array<{ title: string; angle: string; format: string }>
}

type IndustryNewsResult = {
  mode: 'industry_news'
  keyword: string
  articles: Array<{
    title: string
    url: string
    summary: string
    reactionAngles: Array<{ angle: string; stance: 'soutenir' | 'contester' | 'partager_experience' }>
  }>
}

const FORMAT_LABELS: Record<string, string> = {
  QUESTION_BOX: 'Interview',
  TELEPROMPTER: 'Guide',
  HOT_TAKE: 'Réaction',
  STORYTELLING: 'Histoire',
  DAILY_TIP: 'Conseil',
  MYTH_VS_REALITY: 'Mythe vs Réalité',
}

const STANCE_LABELS: Record<string, string> = {
  soutenir: 'Soutenir',
  contester: 'Contester',
  partager_experience: "Partager l'expérience",
}

const STANCE_TONE: Record<string, string> = {
  soutenir: 'bg-emerald-500/10 text-emerald-600',
  contester: 'bg-orange-500/10 text-orange-600',
  partager_experience: 'bg-blue-500/10 text-blue-600',
}

export function UnstuckCard({
  result,
}: {
  result:
    | WeeklyMomentResult
    | ResurrectSeedResult
    | ForgottenDomainResult
    | IndustryNewsResult
}) {
  if (result.mode === 'weekly_moment') {
    return (
      <div className="my-3 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <Flame className="h-3.5 w-3.5" /> Raconte-moi ta semaine
        </div>
        {result.recentCapturedSignals.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 text-xs text-muted-foreground">
              Quelques repères récents pour la conversation :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.recentCapturedSignals.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-raised/60 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {s.kind === 'topic' ? '💡' : '🎬'} {s.label}
                  <span className="text-muted-foreground/60">· il y a {s.daysAgo}j</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Je t'enchaîne avec une question ouverte — prends ton temps, il n'y a pas de bonne
          ou mauvaise réponse.
        </p>
      </div>
    )
  }

  if (result.mode === 'resurrect_seed') {
    if (result.picks.length === 0) {
      return (
        <div className="my-3 rounded-xl border border-border/40 bg-surface-raised/30 p-4 text-sm italic text-muted-foreground">
          Pas de sujet en Graine ou en Archive assez ancien pour mériter d'être ressorti — on va explorer autrement.
        </div>
      )
    }
    return (
      <div className="my-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
          <History className="h-3.5 w-3.5" /> Sujets qui méritent un second regard
        </div>
        <ul className="space-y-3">
          {result.picks.map((pick) => (
            <li
              key={pick.topicId}
              className="rounded-xl border border-border/40 bg-card p-3"
            >
              <p className="text-sm font-medium">{pick.name}</p>
              {pick.pillar && (
                <span className="mt-0.5 inline-block rounded-full bg-surface-raised/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  🎯 {pick.pillar}
                </span>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Pourquoi aujourd'hui :</span>{' '}
                {pick.why}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Angle frais :</span>{' '}
                {pick.freshAngle}
              </p>
              <Link
                href={`/sujets/${pick.topicId}`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ouvrir ce sujet <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (result.mode === 'forgotten_domain') {
    if (!result.domain || result.angles.length === 0) {
      return (
        <div className="my-3 rounded-xl border border-border/40 bg-surface-raised/30 p-4 text-sm italic text-muted-foreground">
          Tous tes domaines ont été couverts récemment — on est dans le rythme, on continue.
        </div>
      )
    }
    return (
      <div className="my-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          <Flower className="h-3.5 w-3.5" /> Domaine oublié : {result.domain}
        </div>
        {result.lastSeenWeeksAgo !== null && (
          <p className="mb-3 text-xs text-muted-foreground">
            Tu n'en as pas parlé depuis {result.lastSeenWeeksAgo} semaine
            {result.lastSeenWeeksAgo !== 1 ? 's' : ''} — quelques angles pour le revisiter :
          </p>
        )}
        <ul className="space-y-3">
          {result.angles.map((a, i) => (
            <li key={i} className="rounded-xl border border-border/40 bg-card p-3">
              <div className="mb-1 flex items-center gap-2">
                <p className="text-sm font-medium">{a.title}</p>
                <span className="ml-auto rounded-full bg-surface-raised/70 px-1.5 py-0.5 text-[10px]">
                  {FORMAT_LABELS[a.format] ?? a.format}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{a.angle}</p>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // industry_news
  if (result.articles.length === 0) {
    return (
      <div className="my-3 rounded-xl border border-border/40 bg-surface-raised/30 p-4 text-sm italic text-muted-foreground">
        Je n'ai pas trouvé d'actu récente digne d'être commentée sur "{result.keyword}" —
        on peut essayer un autre angle.
      </div>
    )
  }
  return (
    <div className="my-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
      <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400">
        <Search className="h-3.5 w-3.5" /> Actu récente sur {result.keyword}
      </div>
      <ul className="space-y-3">
        {result.articles.map((a, i) => (
          <li key={i} className="rounded-xl border border-border/40 bg-card p-3">
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              {a.title} <ExternalLink className="h-3 w-3" />
            </a>
            <p className="mt-1 text-xs text-muted-foreground">{a.summary}</p>
            <div className="mt-2.5 space-y-1.5">
              {a.reactionAngles.map((ang, j) => (
                <div key={j} className="flex items-start gap-2">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      STANCE_TONE[ang.stance] ?? ''
                    }`}
                  >
                    {STANCE_LABELS[ang.stance] ?? ang.stance}
                  </span>
                  <p className="text-xs text-muted-foreground">{ang.angle}</p>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
