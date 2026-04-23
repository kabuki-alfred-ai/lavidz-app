'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { Drawer } from 'vaul'
import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  FileText,
  Film,
  Loader2,
  Mic,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CreativeState } from '@/lib/creative-state'
import { KABOU_TOASTS } from '@/lib/kabou-voice'
import { SubjectSourcesSection } from '@/components/subject/SubjectSourcesSection'
import { FormatCardPreview } from '@/components/subject/FormatCardPreview'
import { FormatCardDrawer } from '@/components/subject/FormatCardDrawer'
import { TopicAtmosphere } from '@/components/subject/TopicAtmosphere'
import { StateTransitionSplash } from '@/components/subject/StateTransitionSplash'
import { MatureMatterSummary } from '@/components/subject/MatureMatterSummary'
import {
  hasSeenTransition,
  markTransitionSeen,
  clearTransition,
  isUpwardTransition,
} from '@/lib/topic-transition-memory'
import { ThesisBanner } from '@/components/subject/ThesisBanner'
import { CreativeStateTimeline } from '@/components/subject/CreativeStateTimeline'
import { SubjectKabouPanel } from './SubjectKabouPanel'
import { isRecordingGuide, type RecordingGuide } from '@/lib/recording-guide'
import type { NarrativeAnchor } from '@/lib/narrative-anchor'
import type { RecordingScript } from '@/lib/recording-script'
import { Eye } from 'lucide-react'

type Topic = {
  id: string
  name: string
  brief: string | null
  pillar: string | null
  status: 'DRAFT' | 'READY' | 'ARCHIVED'
  threadId: string
  updatedAt: string
  /** @deprecated utiliser `narrativeAnchor` — dual-write pendant 1 sprint */
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
  /** Project auto-created via Project.sessionId (F5). Null si pas encore submit. */
  projectId: string | null
  /** Script format-specific lu depuis Session.recordingScript. Null tant que pas reshape. */
  recordingScript: RecordingScript | null
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
  matterCounts: {
    hookCount: number
    sourcesCount: number
    hookDraftHasContent: boolean
  }
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

const FORMAT_EMOJIS: Record<string, string> = {
  HOT_TAKE: '🔥',
  STORYTELLING: '📖',
  QUESTION_BOX: '❓',
  DAILY_TIP: '💡',
  MYTH_VS_REALITY: '🪞',
  TELEPROMPTER: '📜',
}

// Ordre canonique d'affichage des cartes format (stable d'un Sujet à l'autre).
const FORMAT_ORDER = [
  'HOT_TAKE',
  'STORYTELLING',
  'QUESTION_BOX',
  'DAILY_TIP',
  'MYTH_VS_REALITY',
  'TELEPROMPTER',
] as const

// Mapping tool name Kabou → toast de confirmation (Fix 2.2 : plus de mutations
// silencieuses, l'entrepreneur réalise que Kabou vient de l'aider).
const KABOU_MUTATION_TOAST: Record<string, string> = {
  update_recording_guide_draft: '✨ Kabou a enrichi ton fil conducteur',
  reshape_recording_guide_to_format: '🎬 Kabou a reformaté ton fil conducteur',
  update_topic_brief: '✏️ Angle mis à jour par Kabou',
  mark_topic_ready: '✅ Sujet marqué comme prêt',
  commit_editorial_plan: '📅 Plan éditorial calé avec Kabou',
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

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Rangée d'une session dans une carte format. Affiche le titre, le statut
 * avec pastille colorée + CTA contextuel (lancer / revoir / publier / etc.).
 * `muted` = rendu atténué pour les variantes REPLACED de l'accordion.
 */
function SessionRow({ session, muted = false }: { session: SubjectSessionRef; muted?: boolean }) {
  const statusMeta = SESSION_STATUS_LABEL[session.status] ?? SESSION_STATUS_LABEL.PENDING
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${muted ? 'opacity-70' : ''}`}
    >
      <Circle className={`h-2 w-2 shrink-0 fill-current ${statusMeta.tone}`} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm">
          {session.themeName ?? 'Tournage sans titre'}
        </p>
        <p className={`text-xs ${statusMeta.tone}`}>{statusMeta.label}</p>
      </div>
      {session.status === 'PENDING' && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/s/${session.id}`}>
            <Play className="h-3 w-3" /> Lancer
          </Link>
        </Button>
      )}
      {session.status === 'RECORDING' && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/s/${session.id}`}>
            <Play className="h-3 w-3" /> Reprendre
          </Link>
        </Button>
      )}
      {(session.status === 'SUBMITTED' || session.status === 'PROCESSING') && (
        <Button asChild size="sm" variant="ghost">
          <Link href={`/sujets/${session.id}/apres-tournage`}>
            <Video className="h-3 w-3" /> Revoir
          </Link>
        </Button>
      )}
      {session.status === 'DONE' && (
        <Button asChild size="sm" variant="outline">
          <Link href={session.projectId ? `/projects/${session.projectId}/publier` : `/sujets/${session.id}/publier`}>
            <Sparkles className="h-3 w-3" /> Publier
          </Link>
        </Button>
      )}
      {session.status === 'LIVE' && (
        <Button asChild size="sm" variant="ghost">
          <Link href={session.projectId ? `/projects/${session.projectId}/publier` : `/sujets/${session.id}/publier`}>
            <Sparkles className="h-3 w-3" /> En ligne
          </Link>
        </Button>
      )}
      {session.status === 'FAILED' && (
        <Button asChild size="sm" variant="outline">
          <Link href={`/s/${session.id}`}>
            <RefreshCw className="h-3 w-3" /> Retenter
          </Link>
        </Button>
      )}
      {session.status === 'REPLACED' && (
        <span className="text-xs italic text-muted-foreground">Archivée</span>
      )}
    </div>
  )
}

/**
 * Two-pane layout on desktop: main subject detail on the left, live Kabou
 * chat on the right. On mobile a FAB opens a bottom-sheet with Kabou.
 * The page is the canonical home of a Sujet — every action is contextual
 * to its current creative state.
 */
export function SubjectWorkspace({
  initial,
  creativeState,
  availablePillars,
  nextScheduled,
  calendarCount,
  matterCounts,
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
  const [kabouDrawerOpen, setKabouDrawerOpen] = useState(false)
  const kabouInputRef = useRef<HTMLTextAreaElement | null>(null)

  // Progressive workspace — détection transition d'état + splash + stagger.
  const previousStateRef = useRef<CreativeState | null>(null)
  const [activeTransition, setActiveTransition] = useState<{
    from: CreativeState | null
    to: CreativeState
  } | null>(null)
  const [justTransitioned, setJustTransitioned] = useState(false)
  const [matterExpanded, setMatterExpanded] = useState(false)

  useEffect(() => {
    const prev = previousStateRef.current
    // Premier mount : on enregistre l'état courant mais on ne déclenche pas
    // de splash (l'user ouvre une page déjà dans cet état, pas une bascule).
    if (prev === null) {
      previousStateRef.current = creativeState
      return
    }
    if (prev === creativeState) return

    // Transition réelle détectée.
    const upward = isUpwardTransition(prev, creativeState)
    if (!upward) {
      // Redescente : on clear le splash du state d'où on vient, pour qu'il
      // puisse rejouer si l'user remonte plus tard.
      clearTransition(topic.id, prev)
    } else if (!hasSeenTransition(topic.id, creativeState)) {
      // Bascule vers le haut non encore "témoignée" → on joue le splash.
      setActiveTransition({ from: prev, to: creativeState })
      setJustTransitioned(true)
      // Fin du stagger ~1s après splash (splash dure 3.5s, stagger court).
      window.setTimeout(() => setJustTransitioned(false), 1200)
    }
    previousStateRef.current = creativeState
  }, [creativeState, topic.id])

  const handleTransitionClose = useCallback(() => {
    if (activeTransition) {
      markTransitionSeen(topic.id, activeTransition.to)
    }
    setActiveTransition(null)
  }, [activeTransition, topic.id])

  // Story 4 — stagger reveal des sections après transition. On apply un
  // animationDelay inline + animate-fade-in Tailwind uniquement quand la
  // transition vient de se fermer, pour que le reload banal ne ré-anime
  // pas à chaque fois.
  const staggerStyle = useCallback(
    (i: number): React.CSSProperties | undefined =>
      justTransitioned
        ? { animationDelay: `${i * 80}ms`, animationFillMode: 'both' }
        : undefined,
    [justTransitioned],
  )
  const staggerClass = (justTransitioned ? 'animate-fade-in' : '') as string

  // Focus feedback visible quand l'user clique "Explorer avec Kabou" sur
  // desktop — le panel aside étant déjà ouvert, l'ancien `if (isDesktop) return`
  // donnait l'illusion d'un bouton cassé. On focus le textarea + scrollIntoView
  // pour un feedback immédiat et éventuellement guider l'œil.
  const focusKabouInput = useCallback(() => {
    const el = kabouInputRef.current
    if (!el) return
    el.focus()
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])
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
  // Mobile vs desktop split : on mount côté client, on bascule. SSR rend par
  // défaut la version desktop (aside), ce qui correspond à la majorité du
  // traffic et évite un double-mount du SubjectKabouPanel (qui porte le chat
  // actif — deux instances signifieraient deux fetch d'historique).
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Re-sync quand le server-side se rafraîchit (router.refresh après mutation
  // par un tool Kabou), sauf si l'utilisateur est en train d'éditer localement.
  useEffect(() => {
    setTopic(initial)
    if (!editingBrief) setBriefDraft(initial.brief ?? '')
    if (!editingPillar) setPillarDraft(initial.pillar ?? '')
    // editingBrief/editingPillar volontairement hors deps pour éviter les boucles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id, initial.status, initial.brief, initial.pillar, initial.updatedAt, initial.recordingGuide])

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

  // Déclenché quand Kabou utilise un tool qui mute le topic (status, brief,
  // calendrier). Refetch le topic pour mettre à jour l'en-tête immédiatement,
  // puis router.refresh pour re-dériver creativeState/sessions/calendar côté
  // server component. Affiche aussi un toast contextualisé pour que
  // l'entrepreneur réalise que Kabou vient de l'aider (pas de mutation silencieuse).
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
            recordingGuide: isRecordingGuide(updated.recordingGuide)
              ? updated.recordingGuide
              : updated.recordingGuide === null
                ? null
                : prev.recordingGuide,
          }))
        }
      } catch {
        // Si le refetch échoue, router.refresh suffira à re-synchroniser.
      }
      const toastMessage = toolName ? KABOU_MUTATION_TOAST[toolName] : null
      if (toastMessage) flashToast(toastMessage)
      router.refresh()
    },
    [topic.id, router, flashToast],
  )

  const pendingSession = useMemo(
    () =>
      sessions.find((s) => s.status === 'PENDING') ??
      sessions.find((s) => s.status === 'RECORDING'),
    [sessions],
  )

  const doneSession = sessions.find((s) => s.status === 'DONE')

  const isEmptySeed =
    creativeState === 'SEED' && !topic.brief && !topic.recordingGuide && !isArchived

  // Task 3.6 — hero "choisis ton premier format" pour un Sujet MATURE qui n'a
  // encore aucun tournage. Différent d'un SEED vide : ici l'angle est clair,
  // le choix porte sur la forme (HOT_TAKE vs STORYTELLING vs ...).
  const isFreshMature =
    creativeState === 'MATURE' && sessions.length === 0 && !isArchived

  // Task 3.3 — groupe les sessions par contentFormat. Par format on expose au
  // plus UNE session "canonique" (la plus récente non-REPLACED / non-FAILED)
  // et la liste des variantes précédentes (REPLACED) dans un accordion.
  const formatGroups = useMemo(() => {
    type Group = { canonical: SubjectSessionRef | null; variants: SubjectSessionRef[] }
    const map = new Map<string, Group>()
    // sessions arrivent triées createdAt DESC côté server → la première
    // non-REPLACED est la canonique naturelle.
    for (const s of sessions) {
      const key = s.contentFormat ?? 'OTHER'
      if (!map.has(key)) map.set(key, { canonical: null, variants: [] })
      const g = map.get(key)!
      if (s.status === 'REPLACED') {
        g.variants.push(s)
      } else if (!g.canonical) {
        g.canonical = s
      } else {
        // Ne devrait pas arriver grâce à l'index unique partiel DB (F4),
        // mais par précaution on les affiche comme variantes.
        g.variants.push(s)
      }
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

  const usedFormats = useMemo(() => new Set(formatGroups.map((g) => g.format)), [formatGroups])

  // isStale = le narrativeAnchor du Topic a été updated après le dernier
  // reshape du script de cette session (F14). Renderisé en StaleAnchorBadge
  // dans le drawer + permet de proposer le bouton re-sync.
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

  // Re-sync via POST /api/sessions/:id/recording-script/reshape.
  // Le backend lit Topic.narrativeAnchor, reshape vers le format de la
  // session, enrichit par RAG, écrit Session.recordingScript avec
  // anchorSyncedAt updated. router.refresh() re-lit le workspace.
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

  const primaryCta = useMemo(() => {
    if (isArchived) return null
    // Sur un SEED vide on préfère la hero card dédiée, pas un simple bouton.
    if (isEmptySeed) return null
    // Sur un MATURE sans session, le hero "Choisis ton premier format" est
    // déjà un format picker complet — un CTA supplémentaire dédouble le
    // choix et pousse l'user vers le chat alors qu'il vient précisément
    // d'avoir 6 cartes cliquables.
    if (isFreshMature) return null

    if (doneSession) {
      // Task 11.5 — publication vit désormais sur Project. Fallback legacy
      // si le Project n'est pas encore créé (ex: session DONE pré-migration).
      const publishHref = doneSession.projectId
        ? `/projects/${doneSession.projectId}/publier`
        : `/sujets/${doneSession.id}/publier`
      return (
        <Button asChild size="lg">
          <Link href={publishHref}>
            <Sparkles className="h-4 w-4" />
            Lancer ce contenu
          </Link>
        </Button>
      )
    }

    // Un tournage est en cours (status tactique Session) → CTA reprise directe.
    // Le creativeState reste MATURE côté Topic (stratégique, axe orthogonal).
    if (pendingSession) {
      return (
        <Button asChild size="lg">
          <Link href={`/s/${pendingSession.id}`}>
            <Play className="h-4 w-4" />
            Lancer le tournage
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
        onClick={() => {
          if (isDesktop) {
            focusKabouInput()
            return
          }
          setKabouDrawerOpen(true)
        }}
        disabled={isPending}
      >
        <Sparkles className="h-4 w-4" />
        Explorer avec Kabou
      </Button>
    )
  }, [creativeState, doneSession, focusKabouInput, handleMarkReady, isArchived, isDesktop, isEmptySeed, isFreshMature, isPending, pendingSession, topic.brief, topic.id])

  return (
    <>
      {/* Progressive workspace — atmosphère ambient derrière tout le contenu,
         teinte dérivée de creativeState (ambre/émeraude/émeraude profond/muet). */}
      <TopicAtmosphere state={creativeState} />

      {/* Splash de transition — joué une fois par bascule d'état montante,
         skippable par click ou Escape, auto-dismiss 3.5s. */}
      <StateTransitionSplash
        open={activeTransition !== null}
        onClose={handleTransitionClose}
        fromState={activeTransition?.from ?? null}
        toState={activeTransition?.to ?? creativeState}
      />

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

      <ThesisBanner />

      <header className="mb-6">
        <div className="mb-5 rounded-2xl border border-border/40 bg-surface-raised/20 px-4 py-4">
          <CreativeStateTimeline state={creativeState} />
        </div>
        {/* Ancien ReadinessHint (jauge % + checklist) retiré : il contredisait
           la voix Kabou (pas de score chiffré, pas de gamification) et
           doublait le primaryCta qui propose déjà "Marquer comme prêt" en
           EXPLORING. La progression du sujet est surfacée par la timeline +
           l'atmosphère + les transitions — pas par une barre de productivité. */}
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
            <a
              href="#tournages-par-format"
              onClick={(e) => {
                e.preventDefault()
                const target = document.getElementById('tournages-par-format')
                target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground hover:underline underline-offset-2"
              title="Voir les tournages par format"
            >
              <Film className="h-3 w-3" />
              {sessions.length} tournage{sessions.length > 1 ? 's' : ''}
            </a>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_560px]">
        {/* Main subject area — always visible; Kabou est accessible via FAB mobile ou aside desktop */}
        <div className="block">
          {/* Hero onboarding pour un sujet tout frais : évite la "mer grise"
             des sections désactivées et invite directement à dialoguer. */}
          {isEmptySeed && (
            <section className="mb-6 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface-raised/40 to-background p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-2xl">
                🌱
              </div>
              <h2 className="mb-2 text-xl font-semibold tracking-tight">
                Commençons ensemble
              </h2>
              <p className="mb-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Ton sujet vient de germer. Kabou est là pour t'aider à le transformer en un contenu
                qui te ressemble — raconte-lui ton intention, il s'occupe du reste.
              </p>
              <Button
                size="lg"
                onClick={() => {
                  if (isDesktop) {
                    focusKabouInput()
                    return
                  }
                  setKabouDrawerOpen(true)
                }}
                disabled={isPending}
              >
                <Sparkles className="h-4 w-4" />
                {isDesktop ? 'Démarrer avec Kabou' : 'Ouvrir Kabou'}
              </Button>
              {isDesktop && (
                <p className="mt-3 text-xs italic text-muted-foreground">
                  Kabou t'écoute déjà sur ta droite →
                </p>
              )}
            </section>
          )}

          {/* Task 3.6 — Hero "choisis ton premier format" pour un Sujet MATURE
             qui n'a encore aucun tournage. L'angle est posé, reste à choisir
             la forme. Évite de pousser l'entrepreneur vers un seul CTA générique. */}
          {isFreshMature && (
            <section className="mb-6 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-surface-raised/40 to-background p-6 shadow-sm">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
                🌳
              </div>
              <h2 className="mb-2 text-xl font-semibold tracking-tight">
                Ton sujet est prêt — choisis ton premier format
              </h2>
              <p className="mb-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                L'angle est posé. Pour le tournage, pose-toi 30 secondes sur la forme
                qui colle le mieux à cette idée. Chaque format déclenche un script adapté.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {FORMAT_ORDER.map((fmt) => (
                  <Link
                    key={fmt}
                    href={`/chat?topicId=${topic.id}&action=record&format=${fmt}`}
                    className="group flex items-start gap-3 rounded-xl border border-border/40 bg-background/40 p-3 transition hover:border-emerald-500/40 hover:bg-emerald-500/5"
                  >
                    <span className="text-xl" aria-hidden>
                      {FORMAT_EMOJIS[fmt]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {FORMAT_LABELS[fmt]}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

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

          {/* Story 3 & 4 — en MATURE, les sections éditoriales se plient
             dans un bandeau synthétique "Mon sujet en matière" pour que le
             focus descende vers les cartes format. Déplié = rendu normal. */}
          {creativeState === 'MATURE' && !matterExpanded && (
            <MatureMatterSummary
              briefLength={topic.brief?.length ?? 0}
              anchorBulletCount={
                topic.narrativeAnchor?.bullets.filter((b) => b.trim().length > 0).length ?? 0
              }
              hookCount={matterCounts.hookCount}
              sourcesCount={matterCounts.sourcesCount}
              hookDraftHasContent={matterCounts.hookDraftHasContent}
              expanded={false}
              onToggle={() => setMatterExpanded(true)}
            >
              {null}
            </MatureMatterSummary>
          )}

          {creativeState === 'MATURE' && matterExpanded && (
            <div className="mb-3 flex items-center justify-between">
              <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Mon sujet en matière
              </h2>
              <button
                type="button"
                onClick={() => setMatterExpanded(false)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                Replier la matière
              </button>
            </div>
          )}

          {(creativeState !== 'MATURE' || matterExpanded) && (
            <>
              {/* Angle (brief) */}
              <section
                className={`mb-6 rounded-2xl border border-border/50 bg-surface-raised/30 p-5 ${staggerClass}`}
                style={staggerStyle(0)}
              >
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

              {/* Les hooks ont migré au niveau Session (format-specific) — ils
                 vivent désormais dans FormatCardDrawer, pas sur le Topic. Le
                 Topic reste stratégique (angle, narrativeAnchor, sources). */}

              {/* Sources & facts — credible anchors for HOT_TAKE / fact-heavy formats */}
              {!isArchived && creativeState !== 'SEED' && (
                <div className={staggerClass} style={staggerStyle(2)}>
                  <SubjectSourcesSection
                    topicId={topic.id}
                    hasBrief={Boolean(topic.brief && topic.brief.trim().length > 20)}
                    onFlashToast={flashToast}
                  />
                </div>
              )}
            </>
          )}

          {/* Story 3 (format-card-drawer spec) — le script format-specific ne
             flotte plus au milieu de la page. Il vit désormais dans la carte
             format correspondante (preview visible) + le drawer "Voir le
             script complet" plus bas. */}

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

          {/* Task 3.3 — Cartes par format (contentFormat groupé). Chaque carte
             affiche la session canonique (la plus récente non-REPLACED) plus
             un accordion des variantes précédentes. */}
          {formatGroups.length > 0 && !isArchived && (
            <section id="tournages-par-format" className="mb-6 space-y-3 scroll-mt-6">
              <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Film className="h-3.5 w-3.5" />
                Tournages par format
              </h2>
              {formatGroups.map((group) => {
                const canonical = group.canonical
                const variants = group.variants
                const formatEmoji = FORMAT_EMOJIS[group.format] ?? '🎬'
                const formatLabel = FORMAT_LABELS[group.format] ?? group.format
                const canonicalIsActive =
                  canonical && canonical.status !== 'FAILED' && canonical.status !== 'REPLACED'
                // Story 4 — halo d'attention sur la carte qui porte une session
                // en cours d'enregistrement / processing. Ring primary + shadow
                // subtile + pulse via l'atmosphere-pulse keyframe.
                const isLive =
                  !!canonical &&
                  (canonical.status === 'RECORDING' ||
                    canonical.status === 'SUBMITTED' ||
                    canonical.status === 'PROCESSING')
                const expanded = expandedVariants.has(group.format)
                return (
                  <article
                    key={group.format}
                    className={`overflow-hidden rounded-2xl border bg-surface-raised/30 transition-shadow ${
                      isLive
                        ? 'border-primary/30 shadow-lg shadow-primary/10 ring-2 ring-primary/25'
                        : 'border-border/50'
                    }`}
                  >
                    <header className="flex items-center gap-3 border-b border-border/30 px-4 py-3">
                      <span className="text-lg" aria-hidden>
                        {formatEmoji}
                      </span>
                      <h3 className="flex-1 text-sm font-semibold">{formatLabel}</h3>
                      {canonicalIsActive ? (
                        <Button asChild size="sm" variant="ghost" disabled>
                          <span className="text-xs text-muted-foreground" title="Un tournage est déjà en cours dans ce format">
                            Tournage actif
                          </span>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/chat?topicId=${topic.id}&action=record&format=${group.format}`}
                          >
                            <Plus className="h-3 w-3" />
                            {canonical ? 'Tenter une variante' : 'Nouveau tournage'}
                          </Link>
                        </Button>
                      )}
                    </header>

                    {canonical && (
                      <div className="space-y-2 px-4 py-3">
                        <SessionRow session={canonical} />
                        <FormatCardPreview
                          script={canonical.recordingScript}
                          anchor={topic.narrativeAnchor}
                          compact
                        />
                        <button
                          type="button"
                          onClick={() => setOpenDrawerFormat(group.format)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                        >
                          <Eye className="h-3 w-3" />
                          Voir le script complet
                        </button>
                      </div>
                    )}
                    {!canonical && (
                      <div className="space-y-2 px-4 py-3">
                        <FormatCardPreview
                          script={null}
                          anchor={topic.narrativeAnchor}
                          compact
                        />
                        {variants.length === 0 && (
                          <p className="text-xs italic text-muted-foreground/70">
                            Pas encore de tournage dans ce format.
                          </p>
                        )}
                      </div>
                    )}

                    {variants.length > 0 && (
                      <div className="border-t border-border/30 bg-background/20">
                        <button
                          type="button"
                          onClick={() => toggleVariants(group.format)}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-muted-foreground hover:bg-background/40"
                        >
                          {expanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          Variantes précédentes ({variants.length})
                        </button>
                        {expanded && (
                          <ul>
                            {variants.map((v) => (
                              <SessionRow key={v.id} session={v} muted />
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    <FormatCardDrawer
                      open={openDrawerFormat === group.format}
                      onOpenChange={(v) => setOpenDrawerFormat(v ? group.format : null)}
                      formatLabel={formatLabel}
                      formatEmoji={formatEmoji}
                      topicId={topic.id}
                      format={group.format}
                      canonical={canonical}
                      anchor={topic.narrativeAnchor}
                      isStale={computeStale(canonical?.recordingScript ?? null)}
                      onResync={() =>
                        canonical ? handleResync(group.format, canonical.id) : Promise.resolve()
                      }
                      resyncing={resyncingFormat === group.format}
                    />
                  </article>
                )
              })}
            </section>
          )}

          {/* Ajouter un format pas encore exploré */}
          {!isArchived && creativeState === 'MATURE' && formatGroups.length > 0 && formatGroups.length < FORMAT_ORDER.length && (
            <section className="mb-6 rounded-2xl border border-dashed border-border/40 bg-background/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Tenter un autre format
              </p>
              <div className="flex flex-wrap gap-2">
                {FORMAT_ORDER.filter((fmt) => !usedFormats.has(fmt)).map((fmt) => (
                  <Link
                    key={fmt}
                    href={`/chat?topicId=${topic.id}&action=record&format=${fmt}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-surface-raised/30 px-3 py-1 text-xs transition hover:bg-surface-raised/60"
                  >
                    <span aria-hidden>{FORMAT_EMOJIS[fmt]}</span>
                    {FORMAT_LABELS[fmt]}
                  </Link>
                ))}
              </div>
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

        {/* Kabou panel desktop — rendered only on desktop to avoid double-mount
           with the mobile drawer (chaque mount = un fetch d'historique séparé). */}
        {isDesktop && (
          <aside className="h-[calc(100svh-14rem)] min-h-[400px] max-h-[860px] hidden lg:block">
            <SubjectKabouPanel
              topicId={topic.id}
              threadId={topic.threadId}
              subjectName={topic.name}
              onTopicMutated={handleTopicMutated}
              inputRef={kabouInputRef}
            />
          </aside>
        )}
      </div>

      {/* FAB + bottom sheet Kabou sur mobile. Permet de consulter Kabou "en
         passant" sans quitter le sujet (pattern Slack/Discord mobile). */}
      {!isDesktop && (
        <>
          <button
            type="button"
            onClick={() => setKabouDrawerOpen(true)}
            className="fixed bottom-6 right-5 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 transition active:scale-95 lg:hidden"
            aria-label="Ouvrir Kabou"
          >
            <MessageCircle className="h-5 w-5" />
            Kabou
          </button>
          <Drawer.Root
            open={kabouDrawerOpen}
            onOpenChange={setKabouDrawerOpen}
            snapPoints={[0.6, 0.92]}
          >
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
              <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-full max-h-[92vh] flex-col rounded-t-2xl border border-b-0 border-border/50 bg-card focus:outline-none">
                <div className="mx-auto mt-2 h-1.5 w-12 flex-none rounded-full bg-muted" />
                <Drawer.Title className="sr-only">Kabou sur {topic.name}</Drawer.Title>
                <Drawer.Description className="sr-only">
                  Discute avec Kabou sans quitter ton sujet.
                </Drawer.Description>
                <div className="flex-1 overflow-hidden p-2">
                  <SubjectKabouPanel
                    topicId={topic.id}
                    threadId={topic.threadId}
                    subjectName={topic.name}
                    onTopicMutated={handleTopicMutated}
                  />
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-border/40 bg-card px-4 py-2 text-xs shadow-lg lg:bottom-6"
        >
          {toast}
        </div>
      )}
    </div>
    </>
  )
}
