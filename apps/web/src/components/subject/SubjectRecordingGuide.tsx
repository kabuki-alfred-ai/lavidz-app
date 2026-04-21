'use client'

import { ListChecks, Quote, BookOpen, Flame, Lightbulb, ScrollText } from 'lucide-react'
import {
  GUIDE_KIND_LABELS,
  type RecordingGuide,
  type StorytellingBeatLabel,
} from '@/lib/recording-guide'

interface SubjectRecordingGuideProps {
  guide: RecordingGuide
  compact?: boolean
}

const BEAT_LABELS: Record<StorytellingBeatLabel, string> = {
  setup: 'Mise en place',
  tension: 'Tension',
  climax: 'Bascule',
  resolution: 'Résolution',
}

/**
 * Renderer polymorphe du fil conducteur d'enregistrement. Switch sur `kind` et
 * délègue à 6 sous-renderers. Prop `compact` réduit le padding / taille pour
 * l'usage sidebar pendant le tournage.
 */
export function SubjectRecordingGuide({ guide, compact = false }: SubjectRecordingGuideProps) {
  const wrapperClass = compact
    ? 'rounded-xl border border-border/40 bg-card/60 p-3 text-xs'
    : 'rounded-2xl border border-border/50 bg-surface-raised/30 p-5 text-sm'

  const headerClass = compact
    ? 'mb-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground'
    : 'mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground'

  const Icon = ICON_BY_KIND[guide.kind]

  return (
    <section className={wrapperClass}>
      <h2 className={headerClass}>
        <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        {GUIDE_KIND_LABELS[guide.kind]}
      </h2>
      <Body guide={guide} compact={compact} beatLabels={BEAT_LABELS} />
    </section>
  )
}

const ICON_BY_KIND = {
  draft: ListChecks,
  myth_vs_reality: Quote,
  qa: ListChecks,
  storytelling: BookOpen,
  hot_take: Flame,
  daily_tip: Lightbulb,
  teleprompter: ScrollText,
} as const

function Body({
  guide,
  compact,
  beatLabels,
}: {
  guide: RecordingGuide
  compact: boolean
  beatLabels: Record<StorytellingBeatLabel, string>
}) {
  const gap = compact ? 'space-y-1.5' : 'space-y-2'

  switch (guide.kind) {
    case 'draft':
      return (
        <ul className={gap}>
          {guide.bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[0.1em] text-muted-foreground">•</span>
              <span className="flex-1 leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      )

    case 'myth_vs_reality':
      return (
        <div className={gap}>
          {guide.pairs.map((p, i) => (
            <div
              key={i}
              className={`grid gap-2 rounded-xl border border-border/40 bg-background/30 ${compact ? 'p-2' : 'p-3'}`}
            >
              <div>
                <p className="mb-0.5 text-[10px] uppercase tracking-widest text-red-500">
                  Mythe
                </p>
                <p className="leading-relaxed">{p.myth}</p>
              </div>
              <div>
                <p className="mb-0.5 text-[10px] uppercase tracking-widest text-emerald-500">
                  Réalité
                </p>
                <p className="leading-relaxed">{p.reality}</p>
              </div>
            </div>
          ))}
        </div>
      )

    case 'qa':
      return (
        <ol className={`list-decimal ${compact ? 'pl-4' : 'pl-5'} ${gap}`}>
          {guide.items.map((it, i) => (
            <li key={i} className="leading-relaxed">
              <p className="font-medium">{it.question}</p>
              {it.keyPoints.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {it.keyPoints.map((kp, j) => (
                    <li key={j} className="flex gap-1.5">
                      <span className="mt-[0.1em]">↳</span>
                      <span>{kp}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )

    case 'storytelling':
      return (
        <ol className={`relative border-l border-border/50 ${compact ? 'pl-3' : 'pl-4'} ${gap}`}>
          {guide.beats.map((b, i) => (
            <li key={i} className="relative leading-relaxed">
              <span className="absolute -left-[1.05rem] mt-1.5 h-2 w-2 rounded-full bg-primary/70" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/80">
                {beatLabels[b.label] ?? b.label}
              </p>
              <p>{b.text}</p>
            </li>
          ))}
        </ol>
      )

    case 'hot_take':
      return (
        <div className={gap}>
          <div className={`rounded-xl bg-primary/5 border border-primary/20 ${compact ? 'p-2.5' : 'p-3'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Thèse
            </p>
            <p className="leading-relaxed font-medium">{guide.thesis}</p>
          </div>
          <ul className="space-y-1">
            {guide.arguments.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[0.1em] text-primary/70 font-semibold">{i + 1}.</span>
                <span className="flex-1 leading-relaxed">{a}</span>
              </li>
            ))}
          </ul>
          <p
            className={`mt-1 rounded-xl bg-surface-raised/60 ${compact ? 'p-2' : 'p-3'} italic leading-relaxed`}
          >
            &laquo;&nbsp;{guide.punchline}&nbsp;&raquo;
          </p>
        </div>
      )

    case 'daily_tip':
      return (
        <div className={gap}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/80">
              Problème
            </p>
            <p className="leading-relaxed">{guide.problem}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/80">
              Conseil
            </p>
            <p className="leading-relaxed font-medium">{guide.tip}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500/80">
              Application
            </p>
            <p className="leading-relaxed">{guide.application}</p>
          </div>
        </div>
      )

    case 'teleprompter':
      return (
        <pre
          className={`whitespace-pre-wrap font-sans leading-relaxed ${compact ? 'text-xs' : 'text-sm'} text-foreground/90`}
        >
          {guide.script}
        </pre>
      )
  }
}
