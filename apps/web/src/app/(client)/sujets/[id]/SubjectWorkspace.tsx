'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useDrag } from '@use-gesture/react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileText, Loader2, MessageCircle, Mic, Play, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { CreativeState } from '@/lib/creative-state'
import { deriveCreativeState } from '@/lib/creative-state'
import { KABOU_TOASTS } from '@/lib/kabou-voice'
import { SubjectBreadcrumb } from '@/components/subject/SubjectBreadcrumb'
import { SubjectHeader } from '@/components/subject/SubjectHeader'
import type { SubjectSignal } from '@/components/subject/SubjectSignalRail'
import { Hairline } from '@/components/subject/Hairline'
import { SubjectAngleSection } from '@/components/subject/SubjectAngleSection'
import { SubjectPillarsSection } from '@/components/subject/SubjectPillarsSection'
import { SubjectSourcesSection } from '@/components/subject/SubjectSourcesSection'
import { SubjectSessionsSection } from '@/components/subject/SubjectSessionsSection'
import { SubjectTimelineSection } from '@/components/subject/SubjectTimelineSection'
import { SubjectFooter } from '@/components/subject/SubjectFooter'
import { FormatCardDrawer } from '@/components/subject/FormatCardDrawer'
import { TopicAtmosphere } from '@/components/subject/TopicAtmosphere'
import { StateTransitionSplash } from '@/components/subject/StateTransitionSplash'
import {
  hasSeenTransition,
  markTransitionSeen,
  clearTransition,
  isUpwardTransition,
} from '@/lib/topic-transition-memory'
import { SubjectKabouPanel } from './SubjectKabouPanel'
import { SubjectStageTimeline } from '@/components/subject/SubjectStageTimeline'
import { isRecordingGuide, type RecordingGuide } from '@/lib/recording-guide'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'
import type { RecordingScript } from '@/lib/recording-script'

type Topic = {
  id: string
  name: string
  brief: string | null
  pillar: string | null
  status: 'DRAFT' | 'READY' | 'ARCHIVED'
  threadId: string
  createdAt: string
  updatedAt: string
  recordingGuide: RecordingGuide | null
  narrativeAnchor: NarrativeAnchor | null
}

type SubjectSessionRef = {
  id: string
  status: string
  contentFormat: string | null
  createdAt: string
  themeName: string | null
  questionsCount: number
  projectId: string | null
  recordingScript: RecordingScript | null
}

type ScheduledRef = {
  id: string
  scheduledDate: string
  format: string
  aiSuggestions: Record<string, unknown> | null
}

type SubjectEventRef = {
  id: string
  type: string
  actor: string
  metadata: unknown
  createdAt: string
}

interface SubjectWorkspaceProps {
  initial: Topic
  creativeState: CreativeState
  availablePillars: string[]
  nextScheduled: ScheduledRef | null
  calendarCount: number
  matterCounts: {
    hookCount: number
    sourcesCount: number
    hookDraftHasContent: boolean
  }
  sessions: SubjectSessionRef[]
  events?: SubjectEventRef[]
}

const FORMAT_LABELS: Record<string, string> = {
  QUESTION_BOX: 'Interview',
  TELEPROMPTER: 'Guide',
  HOT_TAKE: 'Réaction',
  STORYTELLING: 'Histoire',
  DAILY_TIP: 'Conseil',
  MYTH_VS_REALITY: 'Mythe vs Réalité',
}

const FORMAT_EMOJIS: Record<string, string> = {
  HOT_TAKE: '🔥',
  STORYTELLING: '📖',
  QUESTION_BOX: '❓',
  DAILY_TIP: '💡',
  MYTH_VS_REALITY: '🪞',
  TELEPROMPTER: '📜',
}

const FORMAT_ORDER = [
  'HOT_TAKE',
  'STORYTELLING',
  'QUESTION_BOX',
  'DAILY_TIP',
  'MYTH_VS_REALITY',
  'TELEPROMPTER',
] as const

const KABOU_MUTATION_TOAST: Record<string, string> = {
  update_recording_guide_draft: '✨ Kabou a enrichi ton fil conducteur',
  reshape_recording_guide_to_format: '🎬 Kabou a reformaté ton fil conducteur',
  update_topic_brief: '✏️ Angle mis à jour par Kabou',
  update_narrative_anchor: '✨ Piliers mis à jour par Kabou',
  mark_topic_ready: '✅ Sujet marqué comme prêt',
  commit_editorial_plan: '📅 Plan éditorial calé avec Kabou',
}


/**
 * Page canonique d'un Sujet. Layout 2 colonnes (desktop) / FAB+Drawer (mobile).
 * Structure inspirée du design Bright Lovelace (voir plan) :
 * header "stamp" → 5 sections numérotées §01–§05 pliables → footer actions.
 * La colonne droite est persistante (Kabou sticky) pour que l'entrepreneur
 * n'ait jamais à "aller chercher" son assistant.
 */
export function SubjectWorkspace({
  initial,
  creativeState,
  availablePillars,
  matterCounts,
  sessions,
  events = [],
}: SubjectWorkspaceProps) {
  const router = useRouter()
  const [topic, setTopic] = useState<Topic>(initial)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'sujet' | 'kabou'>('sujet')
  const kabouInputRef = useRef<HTMLTextAreaElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

  // Swipe gauche sur le sujet → ouvre Kabou ; swipe droit sur Kabou → revient au sujet
  const bindSubjectSwipe = useDrag(
    ({ swipe: [sx] }) => { if (sx === -1 && !isDesktop) setMobileTab('kabou') },
    { axis: 'x', swipe: { distance: 60, velocity: [0.5, 0.5] }, filterTaps: true },
  )
  const bindKabouSwipe = useDrag(
    ({ swipe: [sx] }) => { if (sx === 1 && !isDesktop) setMobileTab('sujet') },
    { axis: 'x', swipe: { distance: 60, velocity: [0.5, 0.5] }, filterTaps: true },
  )

  // Cache le bottom nav global du layout sur mobile pendant qu'on est sur cette page.
  useLayoutEffect(() => {
    document.body.setAttribute('data-sujet-detail', '1')
    return () => document.body.removeAttribute('data-sujet-detail')
  }, [])

  // Pillar editor (modal inline)
  const [editingPillar, setEditingPillar] = useState(false)
  const [pillarDraft, setPillarDraft] = useState(topic.pillar ?? '')

  // Transitions (kept from previous workspace)
  const previousStateRef = useRef<CreativeState | null>(null)
  const [activeTransition, setActiveTransition] = useState<{
    from: CreativeState | null
    to: CreativeState
  } | null>(null)

  useEffect(() => {
    const prev = previousStateRef.current
    if (prev === null) {
      previousStateRef.current = creativeState
      return
    }
    if (prev === creativeState) return
    const upward = isUpwardTransition(prev, creativeState)
    if (!upward) {
      clearTransition(topic.id, prev)
    } else if (!hasSeenTransition(topic.id, creativeState)) {
      setActiveTransition({ from: prev, to: creativeState })
    }
    previousStateRef.current = creativeState
  }, [creativeState, topic.id])

  const handleTransitionClose = useCallback(() => {
    if (activeTransition) markTransitionSeen(topic.id, activeTransition.to)
    setActiveTransition(null)
  }, [activeTransition, topic.id])

  // Responsive split (SSR renders desktop).
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Ferme le panneau Kabou au clavier (Escape)
  useEffect(() => {
    if (mobileTab !== 'kabou' || isDesktop) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileTab('sujet') }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mobileTab, isDesktop])

  // Refresh topic when server-side updates propagate.
  useEffect(() => {
    setTopic(initial)
    if (!editingPillar) setPillarDraft(initial.pillar ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id, initial.status, initial.brief, initial.pillar, initial.updatedAt, initial.recordingGuide])

  const isArchived = topic.status === 'ARCHIVED'

  const flashToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const patchTopic = useCallback(
    async (patch: Record<string, unknown>): Promise<boolean> => {
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
        narrativeAnchor: updated.narrativeAnchor ?? prev.narrativeAnchor,
      }))
      flashToast(KABOU_TOASTS.saved)
      return true
    },
    [topic.id, flashToast],
  )

  const handleAngleSave = useCallback(
    async (value: string) => {
      await patchTopic({ brief: value })
    },
    [patchTopic],
  )

  const handlePillarSave = useCallback(async () => {
    const ok = await patchTopic({ pillar: pillarDraft })
    if (ok) setEditingPillar(false)
  }, [pillarDraft, patchTopic])

  const handlePillarsSave = useCallback(
    async (bullets: string[]) => {
      const next: NarrativeAnchor = {
        kind: 'draft',
        bullets,
        updatedAt: new Date().toISOString(),
      }
      await patchTopic({ narrativeAnchor: next })
    },
    [patchTopic],
  )

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

  const handleUnarchive = useCallback(async () => {
    startTransition(async () => {
      await patchTopic({ status: 'DRAFT' })
      router.refresh()
    })
  }, [patchTopic, router])

  const handleTopicMutated = useCallback(
    async (toolName?: string) => {
      try {
        const res = await fetch(`/api/topics/${topic.id}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (res.ok) {
          const updated = (await res.json()) as Partial<Topic> & { recordingGuide?: unknown }
          setTopic((prev) => ({
            ...prev,
            brief: updated.brief ?? prev.brief,
            pillar: updated.pillar ?? prev.pillar,
            status: updated.status ?? prev.status,
            name: updated.name ?? prev.name,
            updatedAt: updated.updatedAt ?? prev.updatedAt,
            narrativeAnchor: updated.narrativeAnchor ?? prev.narrativeAnchor,
            recordingGuide: isRecordingGuide(updated.recordingGuide)
              ? updated.recordingGuide
              : updated.recordingGuide === null
                ? null
                : prev.recordingGuide,
          }))
        }
      } catch {
        // router.refresh compensera
      }
      const toastMessage = toolName ? KABOU_MUTATION_TOAST[toolName] : null
      if (toastMessage) flashToast(toastMessage)
      router.refresh()
    },
    [topic.id, router, flashToast],
  )

  // Groupe sessions par format
  const [openDrawerFormat, setOpenDrawerFormat] = useState<string | null>(null)
  const [resyncingFormat, setResyncingFormat] = useState<string | null>(null)
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())
  const toggleVariants = useCallback((format: string) => {
    setExpandedVariants((prev) => {
      const next = new Set(prev)
      if (next.has(format)) next.delete(format)
      else next.add(format)
      return next
    })
  }, [])

  const formatGroups = useMemo(() => {
    type Group = { canonical: SubjectSessionRef | null; variants: SubjectSessionRef[] }
    const map = new Map<string, Group>()
    for (const s of sessions) {
      const key = s.contentFormat ?? 'OTHER'
      if (!map.has(key)) map.set(key, { canonical: null, variants: [] })
      const g = map.get(key)!
      if (s.status === 'REPLACED') g.variants.push(s)
      else if (!g.canonical) g.canonical = s
      else g.variants.push(s)
    }
    const ordered: Array<{ format: string; canonical: SubjectSessionRef | null; variants: SubjectSessionRef[] }> = []
    for (const fmt of FORMAT_ORDER) {
      const g = map.get(fmt)
      if (g) ordered.push({ format: fmt, canonical: g.canonical, variants: g.variants })
    }
    const other = map.get('OTHER')
    if (other) ordered.push({ format: 'OTHER', canonical: other.canonical, variants: other.variants })
    return ordered
  }, [sessions])

  const missingFormats = useMemo(() => {
    const used = new Set(formatGroups.map((g) => g.format))
    return FORMAT_ORDER.filter((f) => !used.has(f)).map((f) => ({
      format: f,
      emoji: FORMAT_EMOJIS[f] ?? '🎬',
      label: FORMAT_LABELS[f] ?? f,
    }))
  }, [formatGroups])

  const computeStale = useCallback(
    (script: RecordingScript | null): boolean => {
      if (!topic.narrativeAnchor || !script) return false
      const anchorAt = Date.parse(topic.narrativeAnchor.updatedAt)
      const syncedAt = Date.parse(script.anchorSyncedAt)
      if (Number.isNaN(anchorAt) || Number.isNaN(syncedAt)) return false
      return anchorAt > syncedAt
    },
    [topic.narrativeAnchor],
  )

  const handleResync = useCallback(
    async (format: string, sessionId: string) => {
      setResyncingFormat(format)
      try {
        const res = await fetch(`/api/sessions/${sessionId}/recording-script/reshape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ format }),
        })
        if (!res.ok) {
          flashToast(KABOU_TOASTS.oops)
          return
        }
        flashToast('✨ Script re-synchronisé')
        router.refresh()
      } finally {
        setResyncingFormat(null)
      }
    },
    [flashToast, router],
  )

  const handleExploreFormat = useCallback((format: string) => {
    setOpenDrawerFormat(format)
  }, [])

  const mobileKabouInputRef = useRef<HTMLTextAreaElement | null>(null)
  const [kabouPulse, setKabouPulse] = useState(false)

  const focusKabouInput = useCallback(() => {
    if (!isDesktop) {
      setMobileTab('kabou')
      window.setTimeout(() => mobileKabouInputRef.current?.focus(), 350)
      return
    }
    kabouInputRef.current?.focus()
    setKabouPulse(true)
    window.setTimeout(() => setKabouPulse(false), 1200)
  }, [isDesktop])

  const hasAnyBrief = (topic.brief?.trim().length ?? 0) > 0

  // Dérivé localement pour que la transition SEED→EXPLORING se déclenche
  // immédiatement quand Kabou met à jour topic.brief, sans attendre router.refresh().
  const localCreativeState = useMemo(() => deriveCreativeState({
    topicStatus: topic.status,
    brief: topic.brief,
    narrativeAnchor: topic.narrativeAnchor,
    recordingGuide: topic.recordingGuide,
  }), [topic.status, topic.brief, topic.narrativeAnchor, topic.recordingGuide])

  const showSeedFocus = localCreativeState === 'SEED' && !isArchived

  // Primary CTA context-aware
  const pendingSession = useMemo(
    () =>
      sessions.find((s) => s.status === 'PENDING') ??
      sessions.find((s) => s.status === 'RECORDING'),
    [sessions],
  )
  const doneSession = sessions.find((s) => s.status === 'DONE')

  // 4 signaux nommés — pas un score de complétude. Pour l'user : voir d'un
  // coup d'œil ce qui tient. Les seuils match ceux de `deriveCreativeState`.
  const pillarsCount =
    topic.narrativeAnchor?.bullets.filter((b) => b.trim().length > 0).length ?? 0
  const briefRefined = (() => {
    const b = topic.brief?.trim() ?? ''
    if (b.length === 0) return false
    if (b.length >= 400) return true
    const paragraphs = b.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
    if (paragraphs.length >= 2) return true
    return /^\s*([-*]|\d+\.)\s/m.test(b)
  })()
  const signals = useMemo<SubjectSignal[]>(
    () => [
      {
        key: 'angle',
        label: 'Angle',
        hint: 'Un brief refiné (> 400 chars, 2 paragraphes ou liste)',
        done: briefRefined,
      },
      {
        key: 'pillars',
        label: 'Piliers',
        hint: 'Au moins 3 piliers narratifs posés',
        done: pillarsCount >= 3,
      },
      {
        key: 'sources',
        label: 'Sources',
        hint: 'Au moins 2 sources ancrées',
        done: (matterCounts?.sourcesCount ?? 0) >= 2,
      },
      {
        key: 'hook',
        label: 'Hook',
        hint: "Au moins un hook d'accroche posé",
        done:
          (matterCounts?.hookCount ?? 0) >= 1 ||
          (matterCounts?.hookDraftHasContent ?? false),
      },
    ],
    [
      briefRefined,
      pillarsCount,
      matterCounts?.sourcesCount,
      matterCounts?.hookCount,
      matterCounts?.hookDraftHasContent,
    ],
  )
  const signalsDone = signals.filter((s) => s.done).length
  const allSignalsGreen = signalsDone === signals.length

  const primaryCta = useMemo(() => {
    if (isArchived) return null
    if (showSeedFocus) return null
    if (pendingSession) {
      return (
        <Button asChild size="lg">
          <Link href={`/s/${pendingSession.id}`}>
            <Play className="h-4 w-4" />
            {pendingSession.status === 'RECORDING' ? 'Reprendre le tournage' : 'Lancer le tournage'}
          </Link>
        </Button>
      )
    }
    if (doneSession) {
      const href = doneSession.projectId
        ? `/projects/${doneSession.projectId}/publier`
        : `/sujets/${doneSession.id}/publier`
      return (
        <Button asChild size="lg">
          <Link href={href}>
            <Sparkles className="h-4 w-4" />
            Publier le tournage
          </Link>
        </Button>
      )
    }
    if (creativeState === 'MATURE') {
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
      const ready = allSignalsGreen
      return (
        <Button
          size="lg"
          onClick={handleMarkReady}
          disabled={isPending || !topic.brief}
          className={ready ? 'ring-2 ring-primary/40 shadow-md shadow-primary/20' : undefined}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : ready ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {ready ? 'Ton sujet tient debout — marque-le prêt' : 'Marquer comme prêt'}
        </Button>
      )
    }
    return (
      <Button
        size="lg"
        onClick={focusKabouInput}
        disabled={isPending}
      >
        <Sparkles className="h-4 w-4" />
        Explorer avec Kabou
      </Button>
    )
  }, [allSignalsGreen, creativeState, doneSession, focusKabouInput, handleMarkReady, isArchived, isDesktop, isPending, pendingSession, showSeedFocus, topic.brief, topic.id])

  // Kabou context card
  const sourcesCount = 0 // Géré côté client par SubjectSourcesSection ; le contexte Kabou côté serveur injecte le vrai count.
  const sessionsSummary = useMemo(() => {
    const parts: string[] = []
    const recording = sessions.find((s) => s.status === 'RECORDING')
    const pending = sessions.find((s) => s.status === 'PENDING')
    const done = sessions.find((s) => s.status === 'DONE')
    const live = sessions.find((s) => s.status === 'LIVE')
    if (recording) parts.push(`${FORMAT_LABELS[recording.contentFormat ?? ''] ?? 'Tournage'} en cours`)
    if (pending) parts.push(`${FORMAT_LABELS[pending.contentFormat ?? ''] ?? 'Tournage'} prêt`)
    if (done) parts.push(`${FORMAT_LABELS[done.contentFormat ?? ''] ?? 'Tournage'} à publier`)
    if (live) parts.push(`${FORMAT_LABELS[live.contentFormat ?? ''] ?? 'Tournage'} en ligne`)
    return parts.length > 0 ? parts.join(' · ') : null
  }, [sessions])

  const scrollToSessions = useCallback(() => {
    const target = document.getElementById('tournages-section')
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const scrollToSection = useCallback((id: string) => {
    const target = document.getElementById(id)
    if (target) {
      target.setAttribute('open', 'true')
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Progressive reveal — limite le bruit visuel quand le sujet démarre.
  // §01 toujours visible. §02 apparaît dès qu'on a un début d'angle. §03 dès
  // qu'on a au moins 1 pilier. §04 & §05 sont toujours visibles pour ne pas
  // couper l'accès aux tournages déjà existants et à l'historique.
  const [forceShowAll, setForceShowAll] = useState(false)
  const hasAnyPillar = pillarsCount >= 1
  const showSections = {
    angle: true,
    pillars: forceShowAll || hasAnyBrief || creativeState !== 'SEED',
    sources: forceShowAll || hasAnyPillar || creativeState === 'MATURE' || creativeState === 'ARCHIVED',
    sessions: true,
    timeline: true,
  }
  const hiddenCount =
    (showSections.pillars ? 0 : 1) + (showSections.sources ? 0 : 1)

  const handleSignalClick = useCallback(
    (key: SubjectSignal['key']) => {
      // Clic signal = rend visible toutes les sections (si cachées) puis scroll.
      setForceShowAll(true)
      // Laisse le DOM se peindre avant de scroller.
      window.setTimeout(() => {
        switch (key) {
          case 'angle':
            scrollToSection('subject-section-angle')
            break
          case 'pillars':
            scrollToSection('subject-section-pillars')
            break
          case 'sources':
            scrollToSection('subject-section-sources')
            break
          case 'hook':
            scrollToSection('tournages-section')
            break
        }
      }, 50)
    },
    [scrollToSection],
  )

  // Détecte « Kabou vient de proposer l'angle » — si le dernier event
  // brief_edited est actor=kabou et plus récent qu'un éventuel brief_edited
  // user, on affiche un banner dans §01 invitant à valider/retravailler.
  const kabouProposedBriefAt = useMemo<string | null>(() => {
    if (!events || events.length === 0) return null
    const briefEvents = events.filter((e) => e.type === 'brief_edited')
    if (briefEvents.length === 0) return null
    const latest = [...briefEvents].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0]
    return latest.actor === 'kabou' ? latest.createdAt : null
  }, [events])

  return (
    <>
      <TopicAtmosphere state={creativeState} />
      <StateTransitionSplash
        open={activeTransition !== null}
        onClose={handleTransitionClose}
        fromState={activeTransition?.from ?? null}
        toState={activeTransition?.to ?? creativeState}
      />

      <AnimatePresence mode="wait">
        {showSeedFocus ? (
          // ── Focus SEED : Kabou centré, plein écran ─────────────────
          <motion.main
            key="seed-focus"
            className="mx-auto max-w-[640px] px-4 sm:px-6 pt-4 flex flex-col"
            style={{ height: 'calc(100dvh - 4rem)' }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="shrink-0 mb-1">
              <SubjectBreadcrumb createdAt={topic.createdAt} updatedAt={topic.updatedAt} />
            </div>

            <div className="shrink-0 mb-4">
              <div className="mb-2">
                <SubjectStageTimeline state={creativeState} />
              </div>
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight leading-[1.1]">
                {topic.name}
              </h1>
            </div>

            <div className="flex-1 min-h-0">
              <SubjectKabouPanel
                topicId={topic.id}
                threadId={topic.threadId}
                subjectName={topic.name}
                contextBrief={topic.brief}
                contextPillarsCount={pillarsCount}
                contextSourcesCount={0}
                contextSessionsSummary={null}
                creativeState={creativeState}
                narrativeAnchor={topic.narrativeAnchor}
                hasPendingSession={false}
                onTopicMutated={handleTopicMutated}
                inputRef={kabouInputRef}
              />
            </div>

            <div className="mt-3 mb-3 shrink-0 flex items-center justify-center gap-0">
              {(['Angle', 'Piliers', 'Sources', 'Tournage'] as const).map((label, i) => (
                <div key={label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                      i === 0
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/35'
                        : 'bg-muted/60 text-muted-foreground/40'
                    }`}>{i + 1}</span>
                    <span className={`text-[11px] font-mono tracking-wide ${
                      i === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/35'
                    }`}>{label}</span>
                  </div>
                  {i < 3 && <div className="h-px w-8 mx-1.5 bg-border/50 mb-3.5" aria-hidden />}
                </div>
              ))}
            </div>
          </motion.main>
        ) : (
          // ── Full workspace ──────────────────────────────────────────
          <div key="workspace" {...(!isDesktop ? bindSubjectSwipe() : {})}>
            <motion.main
              className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-6 pb-24"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 40 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              transition={prefersReducedMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 600, damping: 40 }}
            >
              <SubjectBreadcrumb createdAt={topic.createdAt} updatedAt={topic.updatedAt} />

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
                <section>
                  <SubjectHeader
                    creativeState={creativeState}
                    title={topic.name}
                    pillar={topic.pillar}
                    onEditPillar={() => setEditingPillar(true)}
                    sessionsCount={sessions.length}
                    onScrollToSessions={scrollToSessions}
                    primaryCta={primaryCta}
                    onRest={handleMarkDraft}
                    restDisabled={isPending || topic.status === 'DRAFT'}
                    isArchived={isArchived}
                    signals={signals}
                    onSignalClick={handleSignalClick}
                  />

                  {editingPillar && (
                    <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 max-w-[680px]">
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
                                  : 'border-border text-muted-foreground hover:bg-surface-raised'
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
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
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

                  <Hairline className="mb-6" />

                  <div className="space-y-6">
                    <SubjectAngleSection
                      id="subject-section-angle"
                      brief={topic.brief}
                      onSave={handleAngleSave}
                      kabouProposedAt={kabouProposedBriefAt}
                      defaultOpen
                    />

                    {showSections.pillars && (
                      <SubjectPillarsSection
                        id="subject-section-pillars"
                        anchor={topic.narrativeAnchor}
                        onSave={handlePillarsSave}
                      />
                    )}

                    {showSections.sources && !isArchived && (
                      <SubjectSourcesSection
                        id="subject-section-sources"
                        topicId={topic.id}
                        hasBrief={Boolean(topic.brief && topic.brief.trim().length > 20)}
                        onFlashToast={flashToast}
                      />
                    )}

                    {hiddenCount > 0 && !forceShowAll && (
                      <button
                        type="button"
                        onClick={() => setForceShowAll(true)}
                        className="text-[12px] text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1.5 px-2 py-1 ml-6"
                      >
                        <span className="h-px w-6 bg-border" aria-hidden />
                        Voir les {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} section{hiddenCount > 1 ? 's' : ''}
                      </button>
                    )}

                    <SubjectSessionsSection
                      id="tournages-section"
                      groups={formatGroups}
                      missingFormats={missingFormats}
                      formatLabels={FORMAT_LABELS}
                      formatEmojis={FORMAT_EMOJIS}
                      narrativeAnchor={topic.narrativeAnchor}
                      expandedVariants={expandedVariants}
                      onToggleVariants={toggleVariants}
                      onExplore={handleExploreFormat}
                      defaultOpen
                    />

                    <SubjectTimelineSection events={events} />
                  </div>

                  <SubjectFooter
                    topicId={topic.id}
                    status={topic.status}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                    onBackToExplore={handleMarkDraft}
                    disabled={isPending}
                  />
                </section>

                {isDesktop && (
                  <aside className="hidden lg:block">
                    <div className={`sticky top-6 h-[calc(100vh-3rem)] max-h-[860px] min-h-[540px] rounded-2xl transition-shadow duration-300 ${kabouPulse ? 'shadow-[0_0_0_3px_hsl(var(--primary)/0.45)]' : ''}`}>
                      <SubjectKabouPanel
                        topicId={topic.id}
                        threadId={topic.threadId}
                        subjectName={topic.name}
                        contextBrief={topic.brief}
                        contextPillarsCount={pillarsCount}
                        contextSourcesCount={sourcesCount}
                        contextSessionsSummary={sessionsSummary}
                        creativeState={creativeState}
                        narrativeAnchor={topic.narrativeAnchor}
                        hasPendingSession={Boolean(pendingSession)}
                        onTopicMutated={handleTopicMutated}
                        inputRef={kabouInputRef}
                      />
                    </div>
                  </aside>
                )}
              </div>

              {/* Overlay Kabou — mobile uniquement */}
              <AnimatePresence>
                {!isDesktop && mobileTab === 'kabou' && (
                  <motion.div
                    className="fixed inset-x-0 top-0 z-30 bg-card flex flex-col lg:hidden"
                    style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
                    initial={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
                    transition={prefersReducedMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 600, damping: 40 }}
                  >
                    <div className="flex flex-col flex-1 h-full" {...bindKabouSwipe()}>
                      <SubjectKabouPanel
                        topicId={topic.id}
                        threadId={topic.threadId}
                        subjectName={topic.name}
                        contextBrief={topic.brief}
                        contextPillarsCount={pillarsCount}
                        contextSourcesCount={sourcesCount}
                        contextSessionsSummary={sessionsSummary}
                        creativeState={creativeState}
                        narrativeAnchor={topic.narrativeAnchor}
                        hasPendingSession={Boolean(pendingSession)}
                        onTopicMutated={handleTopicMutated}
                        inputRef={mobileKabouInputRef}
                        onBack={() => setMobileTab('sujet')}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom nav 2 onglets — mobile uniquement */}
              {!isDesktop && (
                <nav
                  aria-label="Navigation sujet"
                  className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border lg:hidden"
                  style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                  <div className="flex h-16">
                    <button
                      type="button"
                      aria-current={mobileTab === 'sujet' ? 'true' : undefined}
                      onClick={() => { navigator.vibrate?.(10); setMobileTab('sujet') }}
                      className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                        mobileTab === 'sujet' ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      <FileText className={`h-5 w-5 ${mobileTab === 'sujet' ? 'text-primary' : ''}`} />
                      Sujet
                    </button>
                    <div className="w-px bg-border my-3" aria-hidden />
                    <button
                      type="button"
                      aria-current={mobileTab === 'kabou' ? 'true' : undefined}
                      onClick={() => { navigator.vibrate?.(10); setMobileTab('kabou') }}
                      className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                        mobileTab === 'kabou' ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      <MessageCircle className={`h-5 w-5 ${mobileTab === 'kabou' ? 'text-primary' : ''}`} />
                      Kabou
                    </button>
                  </div>
                </nav>
              )}
            </motion.main>
          </div>
        )}
      </AnimatePresence>

      {/* Toast — hors AnimatePresence pour persister entre transitions */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-xs shadow-lg lg:bottom-6"
        >
          {toast}
        </div>
      )}

      {openDrawerFormat && (() => {
        const group = formatGroups.find((g) => g.format === openDrawerFormat)
        const canonical = group?.canonical ?? null
        const formatLabel = FORMAT_LABELS[openDrawerFormat] ?? openDrawerFormat
        const formatEmoji = FORMAT_EMOJIS[openDrawerFormat] ?? '🎬'
        return (
          <FormatCardDrawer
            open={openDrawerFormat !== null}
            onOpenChange={(v) => setOpenDrawerFormat(v ? openDrawerFormat : null)}
            formatLabel={formatLabel}
            formatEmoji={formatEmoji}
            topicId={topic.id}
            format={openDrawerFormat}
            canonical={canonical}
            anchor={topic.narrativeAnchor}
            isStale={computeStale(canonical?.recordingScript ?? null)}
            onResync={() =>
              canonical ? handleResync(openDrawerFormat, canonical.id) : Promise.resolve()
            }
            resyncing={resyncingFormat === openDrawerFormat}
          />
        )
      })()}
    </>
  )
}
