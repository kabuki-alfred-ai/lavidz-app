'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Drawer } from 'vaul'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Video,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubjectRecordingGuide } from '@/components/subject/SubjectRecordingGuide'
import { SubjectNarrativeAnchor } from '@/components/subject/SubjectNarrativeAnchor'
import { StaleAnchorBadge } from '@/components/subject/StaleAnchorBadge'
import { SchedulePublishModal } from '@/components/subject/SchedulePublishModal'
import type { RecordingGuide } from '@/lib/recording-guide'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'

type SessionHooks = {
  native?: { phrase?: string; reason?: string }
  marketing?: { phrase?: string; reason?: string }
  chosen?: 'native' | 'marketing' | null
  generatedAt?: string
}

type ScheduleableFormat =
  | 'QUESTION_BOX'
  | 'TELEPROMPTER'
  | 'HOT_TAKE'
  | 'STORYTELLING'
  | 'DAILY_TIP'
  | 'MYTH_VS_REALITY'

const SCHEDULEABLE_FORMATS = new Set<ScheduleableFormat>([
  'QUESTION_BOX',
  'TELEPROMPTER',
  'HOT_TAKE',
  'STORYTELLING',
  'DAILY_TIP',
  'MYTH_VS_REALITY',
])

interface SessionLite {
  id: string
  status: string
  themeName: string | null
  recordingScript: unknown
  projectId: string | null
}

interface FormatCardDrawerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  formatLabel: string
  formatEmoji: string
  topicId: string
  format: string
  canonical: SessionLite | null
  anchor: NarrativeAnchor | null
  isStale: boolean
  onResync: () => Promise<void> | void
  resyncing?: boolean
}

const SESSION_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'À enregistrer', tone: 'text-amber-600' },
  RECORDING: { label: 'En cours', tone: 'text-blue-500' },
  SUBMITTED: { label: 'Soumise', tone: 'text-blue-500' },
  PROCESSING: { label: 'En traitement', tone: 'text-blue-500' },
  DONE: { label: 'Terminée', tone: 'text-emerald-600' },
  LIVE: { label: 'En ligne', tone: 'text-emerald-700' },
  REPLACED: { label: 'Variante remplacée', tone: 'text-muted-foreground' },
  FAILED: { label: 'Raté', tone: 'text-red-500' },
}

/**
 * Drawer in-place qui expose le script format-specific d'une carte format sans
 * navigation. Mobile : bottom sheet Vaul, desktop : side drawer right.
 *
 * Contenu : StaleAnchorBadge (si applicable) + script complet (via le
 * renderer existant SubjectRecordingGuide qui supporte les 6 kinds
 * format-specific) ou fallback narrativeAnchor (si pas encore de script).
 * Footer : CTA primaire selon statut session + bouton "Re-synchroniser".
 */
export function FormatCardDrawer({
  open,
  onOpenChange,
  formatLabel,
  formatEmoji,
  topicId,
  format,
  canonical,
  anchor,
  isStale,
  onResync,
  resyncing = false,
}: FormatCardDrawerProps) {
  const router = useRouter()
  const [isDesktop, setIsDesktop] = useState(true)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [hooks, setHooks] = useState<SessionHooks | null>(null)
  const [hooksLoading, setHooksLoading] = useState(false)
  const [generatingHooks, setGeneratingHooks] = useState(false)
  const [choosingHook, setChoosingHook] = useState<'native' | 'marketing' | null>(null)
  const [startingRecording, setStartingRecording] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Charge les hooks Session au mount du drawer quand on a une session canonique.
  // Le drawer peut s'ouvrir/fermer plusieurs fois — on refetch à chaque ouverture
  // pour avoir l'état frais après génération/choix depuis une autre vue.
  useEffect(() => {
    if (!open || !canonical?.id) return
    let cancelled = false
    setHooksLoading(true)
    fetch(`/api/sessions/${canonical.id}/hooks`, { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setHooks(null)
          return
        }
        const data = (await res.json()) as SessionHooks | null
        setHooks(data)
      })
      .catch(() => {
        if (!cancelled) setHooks(null)
      })
      .finally(() => {
        if (!cancelled) setHooksLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, canonical?.id])

  const handleGenerateHooks = useCallback(async () => {
    if (!canonical?.id) return
    setGeneratingHooks(true)
    try {
      const res = await fetch(`/api/sessions/${canonical.id}/hooks/generate`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) setHooks(await res.json())
    } finally {
      setGeneratingHooks(false)
    }
  }, [canonical?.id])

  // Lancer le tournage immédiatement — crée la Session côté API via
  // /record-now, puis redirige vers /s/:sessionId pour enchaîner direct sur
  // l'écran tournage. C'est le chemin "maintenant" du choix Lancer/Planifier.
  const handleStartRecording = useCallback(async () => {
    if (startingRecording) return
    setStartingRecording(true)
    setStartError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/record-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ format }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        setStartError(text || "Impossible de créer le tournage — on réessaie ?")
        return
      }
      const data = (await res.json()) as { sessionId?: string }
      if (data.sessionId) {
        router.push(`/s/${data.sessionId}`)
      } else {
        // Fallback improbable : pas de sessionId retourné. On ferme le drawer
        // et on laisse l'user rafraîchir — une session vient d'exister en base.
        router.refresh()
        onOpenChange(false)
      }
    } catch {
      setStartError('Problème réseau — on réessaie ?')
    } finally {
      setStartingRecording(false)
    }
  }, [startingRecording, topicId, format, router, onOpenChange])

  const handleChooseHook = useCallback(
    async (chosen: 'native' | 'marketing') => {
      if (!canonical?.id) return
      setChoosingHook(chosen)
      try {
        const nextChoice = hooks?.chosen === chosen ? null : chosen
        const res = await fetch(`/api/sessions/${canonical.id}/hooks/chosen`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chosen: nextChoice }),
        })
        if (res.ok) setHooks(await res.json())
      } finally {
        setChoosingHook(null)
      }
    },
    [canonical?.id, hooks?.chosen],
  )

  const canSchedule = SCHEDULEABLE_FORMATS.has(format as ScheduleableFormat)

  const script = canonical?.recordingScript ?? null
  const statusMeta = canonical
    ? (SESSION_STATUS_LABEL[canonical.status] ?? SESSION_STATUS_LABEL.PENDING)
    : null

  // Le renderer SubjectRecordingGuide accepte un RecordingGuide dont les 6
  // kinds format-specific correspondent exactement à ceux de RecordingScript.
  // On caste pour réutiliser le composant sans dupliquer la logique (les
  // champs supplémentaires de RecordingScript — anchorSyncedAt,
  // sourceAnchorBullets — sont ignorés par le renderer).
  const scriptAsGuide =
    script && typeof script === 'object' && 'kind' in (script as Record<string, unknown>)
      ? (script as unknown as RecordingGuide)
      : null

  const content = (
    <>
      <header className="flex items-start gap-3 border-b border-border/40 px-5 py-4">
        <span className="text-2xl leading-none" aria-hidden>
          {formatEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{formatLabel}</h2>
          {canonical?.themeName && (
            <p className="truncate text-xs text-muted-foreground">{canonical.themeName}</p>
          )}
          {statusMeta && (
            <p className={`mt-1 inline-flex items-center gap-1.5 text-xs ${statusMeta.tone}`}>
              <Circle className="h-2 w-2 fill-current" />
              {statusMeta.label}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {canonical && (
          <StaleAnchorBadge
            isStale={isStale}
            onResync={onResync}
            resyncing={resyncing}
            className="mb-4"
          />
        )}

        {scriptAsGuide ? (
          <SubjectRecordingGuide guide={scriptAsGuide} />
        ) : anchor ? (
          <div className="space-y-3">
            <SubjectNarrativeAnchor anchor={anchor} />
            <p className="rounded-xl border border-dashed border-border/40 bg-surface-raised/30 p-3 text-xs text-muted-foreground">
              Pas encore de script adapté à ce format — Kabou peut l'adapter
              depuis ton angle.
            </p>
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Pas encore d'angle posé pour ce sujet.
          </p>
        )}

        {/* Accroches Session format-specific — générées par Kabou via
           session-hook.service (RAG topic-scoped). Visible uniquement si
           la carte porte une session canonique (on ne peut pas proposer
           d'accroches sans une session cible). */}
        {canonical && (
          <section className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Accroches — {formatLabel}
              </h3>
              {hooks && (
                <button
                  type="button"
                  onClick={handleGenerateHooks}
                  disabled={generatingHooks}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-60"
                >
                  {generatingHooks ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  En proposer d'autres
                </button>
              )}
            </div>

            {hooksLoading ? (
              <p className="text-xs text-muted-foreground">
                <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                Je regarde ce que Kabou a préparé…
              </p>
            ) : hooks ? (
              <div className="space-y-2">
                {(['native', 'marketing'] as const).map((variant) => {
                  const entry = hooks[variant]
                  if (!entry?.phrase) return null
                  const isChosen = hooks.chosen === variant
                  const label = variant === 'native' ? 'Ta voix' : 'Version scroll'
                  return (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => handleChooseHook(variant)}
                      disabled={choosingHook === variant}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isChosen
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/40 bg-surface-raised/20 hover:border-border/60 hover:bg-surface-raised/30'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        <span>{label}</span>
                        {isChosen ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <Check className="h-3 w-3" />
                            Choisie
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">Choisir</span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">«&nbsp;{entry.phrase}&nbsp;»</p>
                      {entry.reason && (
                        <p className="mt-1.5 text-[11px] italic leading-relaxed text-muted-foreground">
                          {entry.reason}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/40 bg-surface-raised/20 p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Pas encore d'accroches proposées pour ce format.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateHooks}
                  disabled={generatingHooks}
                >
                  {generatingHooks ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Proposer des accroches
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t border-border/40 px-5 py-4 sm:flex-row sm:flex-wrap">
        {canonical && (canonical.status === 'PENDING' || canonical.status === 'RECORDING') && (
          <Button asChild size="lg" className="w-full sm:flex-1">
            <Link href={`/s/${canonical.id}`}>
              <Play className="h-4 w-4" />
              Lancer le tournage
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
        {canonical && (canonical.status === 'SUBMITTED' || canonical.status === 'PROCESSING') && (
          <Button asChild size="lg" variant="outline" className="w-full sm:flex-1">
            <Link href={`/sujets/${canonical.id}/apres-tournage`}>
              <Video className="h-4 w-4" />
              Revoir la session
            </Link>
          </Button>
        )}
        {canonical && (canonical.status === 'DONE' || canonical.status === 'LIVE') && (
          <Button asChild size="lg" className="w-full sm:flex-1">
            <Link
              href={
                canonical.projectId
                  ? `/projects/${canonical.projectId}/publier`
                  : `/sujets/${canonical.id}/publier`
              }
            >
              <Sparkles className="h-4 w-4" />
              Publier ce contenu
            </Link>
          </Button>
        )}
        {!canonical && (
          <div className="flex w-full flex-col gap-2 sm:flex-1">
            <Button
              size="lg"
              onClick={handleStartRecording}
              disabled={startingRecording}
              className="w-full"
            >
              {startingRecording ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Lancer le tournage maintenant
              {!startingRecording && <ArrowRight className="h-4 w-4" />}
            </Button>
            {startError && (
              <p className="text-xs text-destructive">{startError}</p>
            )}
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="w-full justify-center text-muted-foreground hover:text-foreground"
            >
              <Link href={`/chat?topicId=${topicId}&action=record&format=${format}`}>
                <Sparkles className="h-3.5 w-3.5" />
                Adapter l'angle avec Kabou d'abord
              </Link>
            </Button>
          </div>
        )}

        {canonical && scriptAsGuide && (
          <Button
            size="lg"
            variant="outline"
            onClick={() => onResync()}
            disabled={resyncing}
            className="w-full sm:w-auto"
          >
            {resyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Re-synchroniser
          </Button>
        )}

        {/* Planifier — contextualisé au format de la carte. Remplace l'ancien
           ReadyActions global. Dispo dès qu'une action de publication future
           a du sens (format autre que OTHER). Variant outline pour être
           vraiment visible en parallèle du CTA primaire "Lancer maintenant". */}
        {canSchedule && (
          <Button
            size="lg"
            variant="outline"
            onClick={() => setScheduleOpen(true)}
            className="w-full sm:w-auto"
          >
            <CalendarDays className="h-4 w-4" />
            Planifier la publication
          </Button>
        )}
      </footer>

      {canSchedule && (
        <SchedulePublishModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          topicId={topicId}
          defaultFormat={format as ScheduleableFormat}
          onScheduled={() => setScheduleOpen(false)}
        />
      )}
    </>
  )

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={isDesktop ? 'right' : 'bottom'}
      snapPoints={isDesktop ? undefined : [0.6, 0.92]}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Drawer.Content
          className={
            isDesktop
              ? 'fixed right-0 top-0 z-50 flex h-full w-[min(480px,96vw)] flex-col border-l border-border/50 bg-card focus:outline-none'
              : 'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-full max-h-[92vh] flex-col rounded-t-2xl border border-b-0 border-border/50 bg-card focus:outline-none'
          }
        >
          {!isDesktop && (
            <div className="mx-auto mt-2 h-1.5 w-12 flex-none rounded-full bg-muted" />
          )}
          <Drawer.Title className="sr-only">{formatLabel}</Drawer.Title>
          <Drawer.Description className="sr-only">
            Script du format {formatLabel}.
          </Drawer.Description>
          {content}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
