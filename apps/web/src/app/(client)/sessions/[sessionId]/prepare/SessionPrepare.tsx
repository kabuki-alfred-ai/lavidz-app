'use client'

import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import {
  ChevronLeft, Play, Clock, Mic, Type, FileText, Film, CheckCircle2,
  MessageCircle, Flame, BookOpen, Lightbulb, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Question {
  id: string
  text: string
  hint?: string | null
  order: number
}

interface Props {
  session: {
    id: string
    status: string
    contentFormat: string | null
    theme: {
      id: string
      name: string
      introduction?: string | null
      questions: Question[]
    }
    topicEntity?: {
      id: string
      name: string
      brief: string | null
      pillar: string | null
      status: string
    } | null
  }
}

// ─── Format metadata ──────────────────────────────────────────────────────────

const FORMAT_META: Record<string, {
  label: string
  emoji: string
  desc: string
  icon: typeof MessageCircle
  tips: string[]
}> = {
  QUESTION_BOX: {
    label: 'Interview',
    emoji: '🎙️',
    desc: 'Tu réponds à chaque question face caméra, comme une boîte à questions.',
    icon: MessageCircle,
    tips: [
      'Lis la question à haute voix (ou reformule) pour poser le contexte',
      'Respire 1 seconde avant de répondre — ça rend la réponse plus posée',
      'Regarde la caméra, pas l\'écran',
    ],
  },
  TELEPROMPTER: {
    label: 'Guide',
    emoji: '📝',
    desc: 'Tu suis un script affiché en prompteur, phrase par phrase.',
    icon: Type,
    tips: [
      'Parle avec le script, pas AU script — dis-le comme toi',
      'Fais des pauses entre les sections pour permettre des coupes nettes',
      'Répète une phrase si tu la rates, on coupera',
    ],
  },
  HOT_TAKE: {
    label: 'Réaction',
    emoji: '🔥',
    desc: 'Tu donnes ton opinion brute sur un sujet, punchy et direct.',
    icon: Flame,
    tips: [
      'Commence par ta phrase la plus forte — pas d\'intro',
      'Reste < 60s, assume une seule idée par vidéo',
      'Laisse passer l\'émotion, c\'est ce qui fait le hook',
    ],
  },
  STORYTELLING: {
    label: 'Histoire',
    emoji: '📖',
    desc: 'Tu racontes une anecdote avec un début / milieu / leçon.',
    icon: BookOpen,
    tips: [
      'Hook : commence par "Il y a X mois…" ou "La première fois que…"',
      'Garde une seule trame narrative, évite les détours',
      'Finis sur la leçon — c\'est le takeaway',
    ],
  },
  DAILY_TIP: {
    label: 'Conseil',
    emoji: '💡',
    desc: 'Un conseil pratique et actionnable en 30-45 secondes.',
    icon: Lightbulb,
    tips: [
      'Pose le problème en 1 phrase, la solution en 2-3',
      'Un seul conseil par vidéo — reste focus',
      'Termine par un CTA : "essaie et dis-moi"',
    ],
  },
  MYTH_VS_REALITY: {
    label: 'Myth vs Reality',
    emoji: '⚖️',
    desc: 'Tu démontes une idée reçue en 2 parties : mythe → réalité.',
    icon: Sparkles,
    tips: [
      'Énonce clairement : "On dit que X. Faux. En vrai, Y."',
      'Appuie ta réalité avec 1 preuve concrète ou chiffre',
      'Reste ferme — pas de "c\'est plus nuancé"',
    ],
  },
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'À enregistrer', class: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  RECORDING: { label: 'En cours', class: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  SUBMITTED: { label: 'Soumise', class: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  PROCESSING: { label: 'Traitement', class: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  DONE: { label: 'Terminée', class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  FAILED: { label: 'Échec', class: 'bg-red-500/10 text-red-500 border-red-500/20' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionPrepare({ session }: Props) {
  const format = session.contentFormat ? FORMAT_META[session.contentFormat] : null
  const FormatIcon = format?.icon ?? Film
  const questions = session.theme.questions ?? []
  const statusMeta = STATUS_BADGE[session.status] ?? STATUS_BADGE.PENDING
  const canRecord = session.status === 'PENDING'
  const estimatedMinutes = Math.max(1, Math.round(questions.length * 1.2))

  const backHref = session.topicEntity ? `/topics/${session.topicEntity.id}` : '/home'

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-8">
      {/* Back link */}
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
          {session.topicEntity ? 'Retour au sujet' : 'Retour'}
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${statusMeta.class}`}>
            {statusMeta.label}
          </span>
          {session.topicEntity?.pillar && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/5 text-primary/70">
              {session.topicEntity.pillar}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{session.theme.name}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <FormatIcon size={14} />
            {format?.label ?? 'Format libre'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} />
            ~{estimatedMinutes} min
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText size={14} />
            {questions.length} question{questions.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Brief */}
      {session.topicEntity?.brief && (
        <div className="rounded-2xl border border-border/40 bg-muted/10 p-5 space-y-2">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Brief du sujet
            </p>
          </div>
          <div className="text-sm text-foreground/90 leading-relaxed prose prose-sm max-w-none [&_p]:my-1 [&_strong]:text-foreground">
            <ReactMarkdown>{session.topicEntity.brief}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Format + tips */}
      {format && (
        <div className="rounded-2xl border border-border/40 bg-card/50 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
              {format.emoji}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Format : {format.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{format.desc}</p>
            </div>
          </div>
          <ul className="space-y-1.5 pl-1">
            {format.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <CheckCircle2 size={12} className="text-emerald-500 mt-1 shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mic size={14} className="text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Déroulé — {questions.length} question{questions.length > 1 ? 's' : ''}
          </p>
        </div>
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 italic">Aucune question définie pour ce thème.</p>
        ) : (
          <ol className="space-y-2.5">
            {questions.map((q, idx) => (
              <li
                key={q.id}
                className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/30 p-4"
              >
                <span className="shrink-0 w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground leading-snug">{q.text}</p>
                  {q.hint && (
                    <p className="text-xs text-muted-foreground leading-relaxed">💡 {q.hint}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* CTA */}
      <div className="sticky bottom-4 md:static flex flex-col md:flex-row md:items-center gap-3 pt-2">
        {canRecord ? (
          <Link href={`/s/${session.id}`} className="flex-1">
            <Button size="lg" className="w-full gap-2 shadow-lg">
              <Play size={16} /> Lancer l&apos;enregistrement
            </Button>
          </Link>
        ) : (
          <div className="flex-1 rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-sm text-muted-foreground text-center">
            Cette session a déjà été enregistrée ({statusMeta.label.toLowerCase()}).
          </div>
        )}
        <Link href={backHref}>
          <Button variant="outline" size="lg" className="w-full md:w-auto">
            Retour
          </Button>
        </Link>
      </div>
    </div>
  )
}
