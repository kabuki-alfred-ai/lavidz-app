'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Film,
  Loader2,
  Mic,
  Pencil,
  Play,
  Sparkles,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  CREATIVE_STATE_META,
  type CreativeState,
} from '@/lib/creative-state'
import { KABOU_TOASTS } from '@/lib/kabou-voice'
import { SubjectHookSection } from '@/components/subject/SubjectHookSection'
import { SubjectSourcesSection } from '@/components/subject/SubjectSourcesSection'
import { SubjectKabouPanel } from './SubjectKabouPanel'

type Topic = {
  id: string
  name: string
  brief: string | null
  pillar: string | null
  status: 'DRAFT' | 'READY' | 'ARCHIVED'
  threadId: string
  updatedAt: string
}

type SubjectSessionRef = {
  id: string
  status: string
  contentFormat: string | null
  createdAt: string
  themeName: string | null
  questionsCount: number
}

type ScheduledRef = {
  id: string
  scheduledDate: string
  format: string
  aiSuggestions: Record<string, unknown> | null
}

interface SubjectWorkspaceProps {
  initial: Topic
  creativeState: CreativeState
  availablePillars: string[]
  nextScheduled: ScheduledRef | null
  calendarCount: number
  sessions: SubjectSessionRef[]
}

const FORMAT_LABELS: Record<string, string> = {
  QUESTION_BOX: 'Interview',
  TELEPROMPTER: 'Guide',
  HOT_TAKE: 'Réaction',
  STORYTELLING: 'Histoire',
  DAILY_TIP: 'Conseil',
  MYTH_VS_REALITY: 'Mythe vs Réalité',
}

const SESSION_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'À enregistrer', tone: 'text-amber-600' },
  RECORDING: { label: 'En cours', tone: 'text-blue-500' },
  SUBMITTED: { label: 'Soumise', tone: 'text-blue-500' },
  PROCESSING: { label: 'En traitement', tone: 'text-blue-500' },
  DONE: { label: 'Terminée', tone: 'text-emerald-600' },
  FAILED: { label: 'Échec', tone: 'text-red-500' },
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Two-pane layout on desktop: main subject detail on the left, live Kabou
 * chat on the right. On mobile we switch with tabs. The page is the canonical
 * home of a Sujet — every action is contextual to its current creative state.
 */
export function SubjectWorkspace({
  initial,
  creativeState,
  availablePillars,
  nextScheduled,
  calendarCount,
  sessions,
}: SubjectWorkspaceProps) {
  const router = useRouter()
  const [topic, setTopic] = useState<Topic>(initial)
  const [isPending, startTransition] = useTransition()
  const [editingBrief, setEditingBrief] = useState(false)
  const [briefDraft, setBriefDraft] = useState(topic.brief ?? '')
  const [editingPillar, setEditingPillar] = useState(false)
  const [pillarDraft, setPillarDraft] = useState(topic.pillar ?? '')
  const [toast, setToast] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'subject' | 'kabou'>('subject')

  const meta = CREATIVE_STATE_META[creativeState]
  const isArchived = topic.status === 'ARCHIVED'

  const flashToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const patchTopic = useCallback(
    async (patch: Partial<Pick<Topic, 'brief' | 'pillar' | 'status'>>): Promise<boolean> => {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        flashToast(KABOU_TOASTS.oops)
        return false
      }
      const updated = await res.json()
      setTopic((prev) => ({
        ...prev,
        brief: updated.brief ?? prev.brief,
        pillar: updated.pillar ?? prev.pillar,
        status: updated.status ?? prev.status,
        updatedAt: updated.updatedAt ?? prev.updatedAt,
      }))
      flashToast(KABOU_TOASTS.saved)
      return true
    },
    [topic.id, flashToast],
  )

  const handleBriefSave = useCallback(async () => {
    const ok = await patchTopic({ brief: briefDraft })
    if (ok) setEditingBrief(false)
  }, [briefDraft, patchTopic])

  const handlePillarSave = useCallback(async () => {
    const ok = await patchTopic({ pillar: pillarDraft })
    if (ok) setEditingPillar(false)
  }, [pillarDraft, patchTopic])

  const handleMarkReady = useCallback(async () => {
    startTransition(async () => {
      await patchTopic({ status: 'READY' })
      router.refresh()
    })
  }, [patchTopic, router])

  const handleMarkDraft = useCallback(async () => {
    startTransition(async () => {
      await patchTopic({ status: 'DRAFT' })
      router.refresh()
    })
  }, [patchTopic, router])

  const handleArchive = useCallback(async () => {
    startTransition(async () => {
      await patchTopic({ status: 'ARCHIVED' })
      router.refresh()
    })
  }, [patchTopic, router])

  const pendingSession = useMemo(
    () =>
      sessions.find((s) => s.status === 'PENDING') ??
      sessions.find((s) => s.status === 'RECORDING'),
    [sessions],
  )

  const doneSession = sessions.find((s) => s.status === 'DONE')

  const primaryCta = useMemo(() => {
    if (isArchived) return null

    if (doneSession) {
      return (
        <Button asChild size="lg">
          <Link href={`/sujets/${doneSession.id}/publier`}>
            <Sparkles className="h-4 w-4" />
            Lancer ce contenu
          </Link>
        </Button>
      )
    }

    if (creativeState === 'PRODUCING' && pendingSession) {
      return (
        <Button asChild size="lg">
          <Link href={`/s/${pendingSession.id}`}>
            <Play className="h-4 w-4" />
            Lancer le tournage
          </Link>
        </Button>
      )
    }

    if (creativeState === 'MATURE' || creativeState === 'SCHEDULED') {
      return (
        <Button asChild size="lg">
          <Link href={`/chat?topicId=${topic.id}&action=record`}>
            <Mic className="h-4 w-4" />
            Préparer le tournage avec Kabou
          </Link>
        </Button>
      )
    }

    if (creativeState === 'EXPLORING') {
      return (
        <Button
          size="lg"
          onClick={handleMarkReady}
          disabled={isPending || !topic.brief}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Marquer comme prêt
        </Button>
      )
    }

    // SEED
    return (
      <Button
        size="lg"
        onClick={() => setMobileTab('kabou')}
        disabled={isPending}
      >
        <Sparkles className="h-4 w-4" />
        Explorer avec Kabou
      </Button>
    )
  }, [creativeState, doneSession, handleMarkReady, isArchived, isPending, pendingSession, topic.brief, topic.id])

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-5">
        <Link
          href="/topics"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Tous mes sujets
        </Link>
      </div>

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.color}`}
          >
            <span>{meta.emoji}</span>
            {meta.label}
          </span>
          <span className="text-xs text-muted-foreground/70">· {meta.shortHint}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{topic.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {topic.pillar && (
            <button
              type="button"
              onClick={() => setEditingPillar(true)}
              className="inline-flex items-center gap-1 rounded-full bg-surface-raised/50 px-2.5 py-1 text-xs hover:bg-surface-raised"
            >
              <span>🎯 {topic.pillar}</span>
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {!topic.pillar && (
            <button
              type="button"
              onClick={() => setEditingPillar(true)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/40 px-2.5 py-1 text-xs hover:bg-surface-raised/30"
            >
              <Pencil className="h-3 w-3" /> Lier à un domaine
            </button>
          )}
          {nextScheduled && (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <Clock className="h-3 w-3" />
              {formatDate(nextScheduled.scheduledDate)}
            </span>
          )}
          {sessions.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <Film className="h-3 w-3" />
              {sessions.length} tournage{sessions.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border/40 p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('subject')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            mobileTab === 'subject'
              ? 'bg-surface-raised text-foreground'
              : 'text-muted-foreground'
          }`}
        >
          Le sujet
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('kabou')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            mobileTab === 'kabou' ? 'bg-surface-raised text-foreground' : 'text-muted-foreground'
          }`}
        >
          <Sparkles className="mr-1 inline-block h-3.5 w-3.5" />
          Kabou
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_560px]">
        {/* Main subject area */}
        <div className={mobileTab === 'subject' ? 'block' : 'hidden lg:block'}>
          {/* Primary CTA */}
          {primaryCta && <div className="mb-6">{primaryCta}</div>}

          {/* Pillar editor */}
          {editingPillar && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Domaine du sujet
              </label>
              {availablePillars.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {availablePillars.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPillarDraft(p)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        pillarDraft === p
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/40 text-muted-foreground hover:bg-surface-raised/40'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={pillarDraft}
                onChange={(e) => setPillarDraft(e.target.value)}
                placeholder="Nom du domaine"
                className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
              />
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={handlePillarSave}>
                  Valider
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingPillar(false)
                    setPillarDraft(topic.pillar ?? '')
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Angle (brief) */}
          <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Angle du sujet
              </h2>
              {!editingBrief && (
                <button
                  type="button"
                  onClick={() => setEditingBrief(true)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" /> Éditer
                </button>
              )}
            </div>
            {!editingBrief ? (
              topic.brief ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2">
                  <ReactMarkdown>{topic.brief}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  Pas encore d'angle précis. Discute avec Kabou pour en faire émerger un — ou écris-le toi-même en cliquant sur Éditer.
                </p>
              )
            ) : (
              <div>
                <textarea
                  value={briefDraft}
                  onChange={(e) => setBriefDraft(e.target.value)}
                  rows={6}
                  placeholder="Quel est ton angle ? Pour qui ? Quel message veux-tu faire passer ?"
                  className="w-full resize-y rounded-lg border border-border/40 bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={handleBriefSave}>
                    Sauvegarder
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingBrief(false)
                      setBriefDraft(topic.brief ?? '')
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Hooks — two proposed variants (voix native vs marketing) */}
          {!isArchived && (creativeState === 'MATURE' || creativeState === 'SCHEDULED' || creativeState === 'PRODUCING' || creativeState === 'EXPLORING') && (
            <SubjectHookSection
              topicId={topic.id}
              hasBrief={Boolean(topic.brief && topic.brief.trim().length > 20)}
              onFlashToast={flashToast}
            />
          )}

          {/* Sources & facts — credible anchors for HOT_TAKE / fact-heavy formats */}
          {!isArchived && creativeState !== 'SEED' && (
            <SubjectSourcesSection
              topicId={topic.id}
              hasBrief={Boolean(topic.brief && topic.brief.trim().length > 20)}
              onFlashToast={flashToast}
            />
          )}

          {/* Next scheduled */}
          {nextScheduled && (
            <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
              <h2 className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Prochaine diffusion prévue
              </h2>
              <p className="text-sm">
                <span className="font-medium">{formatDate(nextScheduled.scheduledDate)}</span>
                <span className="ml-2 text-muted-foreground">
                  · {FORMAT_LABELS[nextScheduled.format] ?? nextScheduled.format}
                </span>
              </p>
              {nextScheduled.aiSuggestions &&
                typeof nextScheduled.aiSuggestions['hook'] === 'string' && (
                  <p className="mt-2 rounded-lg bg-primary/5 px-3 py-2 text-sm italic">
                    Hook suggéré : &laquo;&nbsp;{nextScheduled.aiSuggestions['hook'] as string}&nbsp;&raquo;
                  </p>
                )}
              {calendarCount > 1 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  + {calendarCount - 1} autre{calendarCount - 1 > 1 ? 's' : ''} dans le calendrier.
                </p>
              )}
            </section>
          )}

          {/* Sessions */}
          {sessions.length > 0 && (
            <section className="mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5">
              <h2 className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Film className="h-3.5 w-3.5" />
                Tournages
              </h2>
              <ul className="space-y-2">
                {sessions.map((s) => {
                  const statusMeta = SESSION_STATUS_LABEL[s.status] ?? SESSION_STATUS_LABEL.PENDING
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/30 px-3 py-2"
                    >
                      <Circle className={`h-2 w-2 fill-current ${statusMeta.tone}`} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm">
                          {s.themeName ?? 'Tournage sans titre'}
                          {s.contentFormat && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              · {FORMAT_LABELS[s.contentFormat] ?? s.contentFormat}
                            </span>
                          )}
                        </p>
                        <p className={`text-xs ${statusMeta.tone}`}>{statusMeta.label}</p>
                      </div>
                      {s.status === 'PENDING' && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/s/${s.id}`}>
                            <Play className="h-3 w-3" /> Lancer
                          </Link>
                        </Button>
                      )}
                      {(s.status === 'SUBMITTED' ||
                        s.status === 'PROCESSING') && (
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/sujets/${s.id}/apres-tournage`}>
                            <Video className="h-3 w-3" /> Revoir
                          </Link>
                        </Button>
                      )}
                      {s.status === 'DONE' && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/sujets/${s.id}/publier`}>
                            <Sparkles className="h-3 w-3" /> Publier
                          </Link>
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* Secondary actions */}
          <section className="mt-8 flex flex-wrap gap-2 border-t border-border/40 pt-6">
            {topic.status === 'READY' && (
              <Button size="sm" variant="ghost" onClick={handleMarkDraft} disabled={isPending}>
                Remettre en exploration
              </Button>
            )}
            {!isArchived && (
              <Button size="sm" variant="ghost" onClick={handleArchive} disabled={isPending}>
                <Archive className="h-3.5 w-3.5" /> Archiver ce sujet
              </Button>
            )}
            {isArchived && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await patchTopic({ status: 'DRAFT' })
                  router.refresh()
                }}
                disabled={isPending}
              >
                Ressortir le sujet
              </Button>
            )}
          </section>
        </div>

        {/* Kabou panel */}
        <aside className={`h-[calc(100vh-16rem)] min-h-[480px] ${mobileTab === 'kabou' ? 'block' : 'hidden lg:block'}`}>
          <SubjectKabouPanel
            topicId={topic.id}
            threadId={topic.threadId}
            subjectName={topic.name}
          />
        </aside>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border/40 bg-card px-4 py-2 text-xs shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
