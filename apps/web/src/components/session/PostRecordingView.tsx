'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Scissors,
  Clock,
  AlertCircle,
  Mic,
  Copy,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  POST_RECORDING_COPY,
  KABOU_TOASTS,
  KABOU_RESET_COPY,
} from '@/lib/kabou-voice'

type ImprovementPath = {
  path: string
  reason?: string
  actionType: 'redo' | 'montage_hint' | 'none'
  targetQuestionId?: string | null
  montageHint?: { type: string; count?: number } | null
}

type AnalysisStatus = 'PENDING' | 'READY' | 'FAILED'

type AnalysisPayload = {
  sessionId: string
  themeName: string | null
  analysis: {
    id: string
    sessionId: string
    status: AnalysisStatus
    summary: string[] | null
    standoutMoment: string | null
    strengths: string[] | null
    improvementPaths: ImprovementPath[] | null
    stats: Record<string, unknown> | null
    errorMessage: string | null
    generatedAt: string | null
  } | null
}

type QuestionRef = { id: string; order: number; text: string }

type RecordingRef = {
  id: string
  questionId: string
  hasVideo: boolean
}

interface PostRecordingViewProps {
  sessionId: string
  themeName?: string | null
  questions: QuestionRef[]
  recordingsCount: number
  totalDurationMs?: number
  /** Path to continue to montage — typically `/process/[sessionId]`. */
  montageHref?: string
  topicId?: string | null
  recordingRefs?: RecordingRef[]
}

const POLL_INITIAL_MS = 2_500
const POLL_MAX_MS = 10_000
const POLL_TIMEOUT_MS = 90_000

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '—'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes} min ${seconds.toString().padStart(2, '0')}s`
}

/**
 * Post-recording view — the entrepreneur lands here after submitting a tournage.
 * Strate 1 (celebration) shows immediately. Strates 2-5 appear as the analysis
 * completes (or a graceful fallback if it fails).
 */
export function PostRecordingView({
  sessionId,
  themeName,
  questions,
  recordingsCount,
  totalDurationMs,
  montageHref,
  topicId,
  recordingRefs = [],
}: PostRecordingViewProps) {
  const router = useRouter()
  const [payload, setPayload] = useState<AnalysisPayload | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [dismissedPaths, setDismissedPaths] = useState<Set<number>>(new Set())
  const [copiedStandout, setCopiedStandout] = useState(false)

  const fetchAnalysis = useCallback(async (): Promise<AnalysisPayload | null> => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/analysis`, { cache: 'no-store' })
      if (!res.ok) {
        setPollError(await res.text())
        return null
      }
      const data = (await res.json()) as AnalysisPayload
      setPayload(data)
      return data
    } catch (err) {
      setPollError(err instanceof Error ? err.message : String(err))
      return null
    }
  }, [sessionId])

  useEffect(() => {
    let cancelled = false
    let delay = POLL_INITIAL_MS
    const start = Date.now()

    const tick = async () => {
      if (cancelled) return
      const data = await fetchAnalysis()
      const status = data?.analysis?.status
      const elapsed = Date.now() - start

      if (status === 'READY' || status === 'FAILED') return
      if (elapsed > POLL_TIMEOUT_MS) return

      delay = Math.min(delay * 1.4, POLL_MAX_MS)
      setTimeout(tick, delay)
    }

    tick()
    return () => {
      cancelled = true
    }
  }, [fetchAnalysis])

  const analysis = payload?.analysis
  const status: AnalysisStatus | null = analysis?.status ?? (payload ? 'PENDING' : null)

  const displayedThemeName = themeName ?? payload?.themeName ?? 'ton tournage'

  // Index questions by id for building readable labels
  const questionsById = useMemo(() => {
    const map = new Map<string, QuestionRef>()
    for (const q of questions) map.set(q.id, q)
    return map
  }, [questions])

  const questionLabel = useCallback(
    (id?: string | null) => {
      if (!id) return 'cette question'
      const q = questionsById.get(id)
      return q ? `la question ${q.order + 1}` : 'cette question'
    },
    [questionsById],
  )

  const summary = analysis?.summary ?? []
  const strengths = analysis?.strengths ?? []
  const paths = analysis?.improvementPaths ?? []
  const standout = analysis?.standoutMoment ?? null
  // Analyse "vide" : le LLM n'a pas pu construire un résumé (transcription trop
  // courte/incohérente ou absente). Dans ce cas on cache les forces — le
  // fallback "rien ne saute aux yeux" serait mensonger — et on montre une
  // bannière honnête au-dessus des pistes.
  const analysisIsEmpty = summary.length === 0 && strengths.length === 0

  const handleRegenerate = useCallback(async () => {
    setActionPending('regenerate')
    try {
      await fetch(`/api/sessions/${sessionId}/analysis/regenerate`, { method: 'POST' })
      setPayload(null)
      setDismissedPaths(new Set())
      // Trigger a fresh fetch cycle
      setTimeout(() => fetchAnalysis(), 1500)
    } finally {
      setActionPending(null)
    }
  }, [sessionId, fetchAnalysis])

  const handleRedo = useCallback(
    async (questionId: string, pathIndex: number) => {
      const key = `redo-${pathIndex}`
      setActionPending(key)
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/recordings/${questionId}/redo`,
          { method: 'POST' },
        )
        if (res.ok) {
          router.push(`/s/${sessionId}`)
        }
      } finally {
        setActionPending(null)
      }
    },
    [sessionId, router],
  )

  const handleMontageHint = useCallback(
    async (hint: ImprovementPath['montageHint'], pathIndex: number) => {
      if (!hint) return
      const key = `hint-${pathIndex}`
      setActionPending(key)
      try {
        await fetch(`/api/sessions/${sessionId}/montage-hints`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(hint),
        })
        setDismissedPaths((prev) => {
          const next = new Set(prev)
          next.add(pathIndex)
          return next
        })
      } finally {
        setActionPending(null)
      }
    },
    [sessionId],
  )

  const handleDismissPath = useCallback((pathIndex: number) => {
    setDismissedPaths((prev) => {
      const next = new Set(prev)
      next.add(pathIndex)
      return next
    })
  }, [])

  // Task 5.2 + 5.5 — "On reprend à zéro" : soft-discard tous les recordings,
  // session retourne en PENDING, redirige l'user sur /s/[id] pour retourner.
  const handleResetSession = useCallback(async () => {
    setActionPending('reset-session')
    try {
      const res = await fetch(`/api/sessions/${sessionId}/reset`, { method: 'POST' })
      if (res.ok) {
        // F20 — event tracking ultra-lite
        console.info('[EVENT] type=session.reset_clicked sessionId=%s', sessionId)
        router.push(`/s/${sessionId}`)
      }
    } finally {
      setActionPending(null)
    }
  }, [sessionId, router])

  // "Reprendre une question" — raccourci vers la première piste redo disponible.
  const firstRedoPath = useMemo(
    () => paths.find((p) => p.actionType === 'redo' && p.targetQuestionId && questionsById.has(p.targetQuestionId)),
    [paths, questionsById],
  )

  const visiblePaths = paths
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => !dismissedPaths.has(i))

  const handleCopyStandout = useCallback(async () => {
    if (!standout) return
    await navigator.clipboard.writeText(standout)
    setCopiedStandout(true)
    setTimeout(() => setCopiedStandout(false), 2000)
  }, [standout])

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 pb-28 sm:py-14 md:pb-10">
        {/* Strate 1 — Celebration */}
        <section className="mb-10 text-center sm:text-left">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" /> Tournage terminé
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {POST_RECORDING_COPY.celebration.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {POST_RECORDING_COPY.celebration.subtitleTemplate(displayedThemeName)}
          </p>
          <p className="mt-2 inline-flex items-center gap-3 text-sm text-muted-foreground/80">
            <Clock className="h-4 w-4" />
            {formatDuration(totalDurationMs)}
            <span className="text-muted-foreground/40">·</span>
            {questions.length} question{questions.length > 1 ? 's' : ''}
            <span className="text-muted-foreground/40">·</span>
            {recordingsCount} prise{recordingsCount > 1 ? 's' : ''}
          </p>
        </section>

        {/* Tes tournages — vidéos par question */}
        {recordingRefs.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-px flex-1 bg-border/40" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Tes tournages
              </h2>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            <div className="flex flex-col gap-6">
              {recordingRefs.map((rec, idx) => {
                const question = questionsById.get(rec.questionId)
                const label = question
                  ? `Question ${question.order + 1}`
                  : `Séquence ${idx + 1}`
                const questionText = question?.text ?? displayedThemeName ?? 'Tournage'
                return (
                  <div key={rec.id} className="rounded-2xl border border-border/60 bg-surface-raised/20 overflow-hidden">
                    <div className="px-4 pt-4 pb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">
                        {label}
                      </p>
                      <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                        {questionText}
                      </p>
                    </div>
                    {rec.hasVideo ? (
                      <video
                        src={`/api/video/${rec.id}?sessionId=${sessionId}`}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-[480px] bg-black"
                      />
                    ) : (
                      <div className="mx-4 mb-4 flex items-center justify-center rounded-xl bg-muted/30 h-32">
                        <p className="text-xs text-muted-foreground">Vidéo non disponible</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Standout moment — hero position, immediately after Strate 1 */}
        {status === 'READY' && standout && (
          <div className="relative mb-10">
            <blockquote className="rounded-2xl border-l-4 border-primary bg-primary/5 px-5 py-4 text-base italic leading-relaxed">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                {POST_RECORDING_COPY.summary.standoutLabel}
              </div>
              &laquo;&nbsp;{standout}&nbsp;&raquo;
            </blockquote>
            <button
              type="button"
              onClick={handleCopyStandout}
              className="absolute top-3 right-3 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copier le moment fort"
            >
              {copiedStandout ? (
                <span className="text-primary font-medium">Copié !</span>
              ) : (
                <Copy className="h-[14px] w-[14px]" />
              )}
            </button>
          </div>
        )}

        {/* Failed state */}
        {status === 'FAILED' && (
          <section className="mb-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="mt-1 h-5 w-5 text-destructive" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold">
                  {POST_RECORDING_COPY.errors.analysisFailed.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {POST_RECORDING_COPY.errors.analysisFailed.subtitle}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={actionPending === 'regenerate'}
                  >
                    {actionPending === 'regenerate' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {POST_RECORDING_COPY.errors.analysisFailed.retry}
                  </Button>
                  {montageHref && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={montageHref}>
                        {POST_RECORDING_COPY.errors.analysisFailed.skip}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Strate 2 — Summary */}
        {status === 'READY' && summary.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-px flex-1 bg-border/40" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {POST_RECORDING_COPY.summary.heading}
              </h2>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              {POST_RECORDING_COPY.summary.intro}
            </p>
            <ul className="space-y-3">
              {summary.map((point, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-border/50 bg-surface-raised/30 px-4 py-3 text-sm leading-relaxed"
                >
                  {point}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Analyse vide — transcription inexploitable. Erreur franche : on ne
           cherche pas à enrober, l'entrepreneur doit comprendre que ce tournage
           ne peut pas être utilisé tel quel. */}
        {status === 'READY' && analysisIsEmpty && (
          <section className="mb-10 rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-destructive">
                  Ce tournage n&apos;est pas exploitable
                </h2>
                <p className="mt-2 text-sm leading-relaxed">
                  {analysis?.errorMessage
                    ? analysis.errorMessage
                    : "La transcription est trop courte ou incohérente — il n'y a pas assez de contenu pour analyser quoi que ce soit."}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <li>• Vérifie que ton micro capte bien ta voix.</li>
                  <li>• Parle franchement et développe chaque réponse.</li>
                  <li>• Refais les prises ci-dessous quand tu es prêt.</li>
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={actionPending === 'regenerate'}
                  >
                    {actionPending === 'regenerate' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Relancer l&apos;analyse
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Strate 3 — Strengths (masquée si l'analyse est vide) */}
        {status === 'READY' && !analysisIsEmpty && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-px flex-1 bg-border/40" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                ✨ {POST_RECORDING_COPY.strengths.heading}
              </h2>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            {strengths.length > 0 ? (
              <ul className="space-y-3">
                {strengths.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{POST_RECORDING_COPY.strengths.empty}</p>
            )}
          </section>
        )}

        {/* Strate 4 — Improvement paths */}
        {status === 'READY' && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-px flex-1 bg-border/40" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {POST_RECORDING_COPY.paths.heading}
              </h2>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            {paths.length === 0 ? (
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                {POST_RECORDING_COPY.paths.empty}
              </p>
            ) : visiblePaths.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Pistes prises en compte. Passe au montage quand tu veux.
              </p>
            ) : (
              <ul className="space-y-4">
                {visiblePaths.map(({ p, i }) => (
                  <li
                    key={i}
                    className="rounded-2xl border border-border/60 bg-surface-raised/30 p-5"
                  >
                    <p className="text-sm leading-relaxed">
                      <span className="font-medium">{POST_RECORDING_COPY.paths.pathPrefix}</span>
                      {p.path}
                    </p>
                    {p.reason && (
                      <p className="mt-2 text-xs text-muted-foreground">{p.reason}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {p.actionType === 'redo' && p.targetQuestionId && questionsById.has(p.targetQuestionId) && (
                        <Button
                          size="sm"
                          onClick={() => handleRedo(p.targetQuestionId!, i)}
                          disabled={actionPending === `redo-${i}`}
                        >
                          {actionPending === `redo-${i}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mic className="h-3.5 w-3.5" />
                          )}
                          {POST_RECORDING_COPY.paths.actions.redo(questionLabel(p.targetQuestionId))}
                        </Button>
                      )}
                      {p.actionType === 'montage_hint' && p.montageHint && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMontageHint(p.montageHint!, i)}
                          disabled={actionPending === `hint-${i}`}
                        >
                          {actionPending === `hint-${i}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Scissors className="h-3.5 w-3.5" />
                          )}
                          {POST_RECORDING_COPY.paths.actions.montageHint}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDismissPath(i)}>
                        {POST_RECORDING_COPY.paths.actions.keep}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Strate 5 — Next steps */}
        {(status === 'READY' || status === 'FAILED') && (
          <section className="mt-12 border-t border-border/40 pt-8 flex flex-col gap-4">
            {/* Desktop primary CTA — hidden on mobile (sticky bar handles it) */}
            {montageHref && (
              <div className="hidden md:block">
                <Button asChild size="lg">
                  <Link href={montageHref}>
                    {POST_RECORDING_COPY.nextSteps.monter}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}

            {/* Row 1: secondary navigation */}
            <div className="flex flex-wrap gap-2">
              {topicId && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/sujets/${topicId}`}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Retour au sujet
                  </Link>
                </Button>
              )}
              {firstRedoPath && firstRedoPath.targetQuestionId && questionsById.has(firstRedoPath.targetQuestionId) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleRedo(
                      firstRedoPath.targetQuestionId!,
                      paths.indexOf(firstRedoPath),
                    )
                  }
                  disabled={actionPending?.startsWith('redo-')}
                >
                  {actionPending?.startsWith('redo-') ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                  Reprendre une question
                </Button>
              )}
            </div>

            {/* Row 2: destructive action — visually separated, small */}
            <div className="pt-2 border-t border-border/20">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground/60 hover:text-destructive transition-colors underline underline-offset-2"
                  >
                    Reprendre à zéro
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{KABOU_RESET_COPY.title}</AlertDialogTitle>
                    <AlertDialogDescription>{KABOU_RESET_COPY.body}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{KABOU_RESET_COPY.cancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetSession} disabled={actionPending === 'reset-session'}>
                      {actionPending === 'reset-session' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {KABOU_RESET_COPY.confirm}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>
        )}

        {pollError && (
          <p className="mt-8 text-xs text-muted-foreground">
            {KABOU_TOASTS.oops} <span className="text-muted-foreground/60">({pollError})</span>
          </p>
        )}
      </div>

      {/* Sticky bottom CTA bar — mobile only */}
      {montageHref && (
        <div
          className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            {(!status || status === 'PENDING') && (
              <div className="flex items-center gap-2 shrink-0">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Analyse en cours...</span>
              </div>
            )}
            <Button asChild size="lg" className="w-full">
              <Link href={montageHref}>
                {POST_RECORDING_COPY.nextSteps.monter}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
