'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import {
  FileText,
  Loader2,
  Send,
  ChevronLeft,
  CalendarDays,
  Film,
  ArrowRight,
  Mic,
  Square,
  Loader2 as Loader,
  Play,
  Archive,
  RefreshCw,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { LinkedInPostsSection } from '@/components/social/LinkedInPostsSection'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TopicData {
  id: string
  name: string
  brief: string | null
  status: 'DRAFT' | 'READY' | 'ARCHIVED'
  pillar: string | null
  threadId: string
  calendarEntries: { id: string; scheduledDate: string; topic: string; format: string; status: string }[]
  sessions: { id: string; status: string; contentFormat: string | null; createdAt: string; theme: { name: string } }[]
  updatedAt: string
}

const STATUS_STYLE: Record<string, { label: string; class: string }> = {
  DRAFT: { label: 'Brouillon', class: 'bg-amber-500/10 text-amber-600' },
  READY: { label: 'Pret', class: 'bg-emerald-500/10 text-emerald-600' },
  ARCHIVED: { label: 'Archive', class: 'bg-muted text-muted-foreground' },
}

const FORMAT_LABELS: Record<string, string> = {
  QUESTION_BOX: 'Interview',
  TELEPROMPTER: 'Guide',
  HOT_TAKE: 'Reaction',
  STORYTELLING: 'Histoire',
  DAILY_TIP: 'Conseil',
  MYTH_VS_REALITY: 'Myth vs Reality',
}

const FORMAT_COLORS: Record<string, string> = {
  QUESTION_BOX: 'bg-blue-500/10 text-blue-600',
  TELEPROMPTER: 'bg-violet-500/10 text-violet-600',
  HOT_TAKE: 'bg-orange-500/10 text-orange-600',
  STORYTELLING: 'bg-pink-500/10 text-pink-600',
  DAILY_TIP: 'bg-emerald-500/10 text-emerald-600',
  MYTH_VS_REALITY: 'bg-amber-500/10 text-amber-600',
}

// ─── Session helpers ────────────────────────────────────────────────────────

const SESSION_STATUS: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  PENDING: { label: 'A enregistrer', class: 'bg-amber-500/10 text-amber-600', icon: Clock },
  RECORDING: { label: 'En cours', class: 'bg-blue-500/10 text-blue-500', icon: Mic },
  SUBMITTED: { label: 'Soumise', class: 'bg-blue-500/10 text-blue-500', icon: Clock },
  PROCESSING: { label: 'En traitement', class: 'bg-blue-500/10 text-blue-500', icon: Loader2 },
  DONE: { label: 'Terminee', class: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  FAILED: { label: 'Echec', class: 'bg-red-500/10 text-red-400', icon: XCircle },
}

interface Rush {
  id: string
  questionText: string
  questionOrder: number
  signedUrl: string
}

function RushesPanel({ sessionId }: { sessionId: string }) {
  const [rushes, setRushes] = useState<Rush[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/sessions/${sessionId}/recordings`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRushes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="space-y-2 pt-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (rushes.length === 0) {
    return <p className="text-xs text-muted-foreground/50 pt-2">Aucun rush disponible</p>
  }

  return (
    <div className="space-y-2 pt-2">
      {rushes.map((rush) => (
        <div key={rush.id} className="rounded-xl overflow-hidden bg-black">
          <video src={rush.signedUrl} controls preload="metadata" className="w-full aspect-video" />
          <div className="px-3 py-2 bg-muted/10">
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">Q{rush.questionOrder + 1}</span> — {rush.questionText}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function SessionsList({ sessions }: { sessions: TopicData['sessions'] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Film size={12} /> Sessions ({sessions.length})
      </p>
      {sessions.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 pl-5">Aucun enregistrement</p>
      ) : (
        sessions.map((s) => {
          const meta = SESSION_STATUS[s.status] ?? SESSION_STATUS.PENDING
          const StatusIcon = meta.icon
          const isDone = s.status === 'DONE' || s.status === 'SUBMITTED' || s.status === 'PROCESSING'
          const isPending = s.status === 'PENDING'
          const isExpanded = expandedId === s.id

          return (
            <div key={s.id} className="rounded-xl bg-muted/10 overflow-hidden">
              <div
                className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
              >
                <StatusIcon size={13} className={meta.class.includes('emerald') ? 'text-emerald-500' : meta.class.includes('amber') ? 'text-amber-500' : 'text-blue-500'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.theme.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground/60">{FORMAT_LABELS[s.contentFormat ?? ''] || ''}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${meta.class}`}>{meta.label}</span>
                  </div>
                </div>
                {isPending && (
                  <Link
                    href={`/sessions/${s.id}/prepare`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Play size={10} /> Commencer
                  </Link>
                )}
                {isDone && (
                  <ChevronDown size={14} className={`text-muted-foreground/40 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </div>
              {isExpanded && isDone && <div className="px-3 pb-3"><RushesPanel sessionId={s.id} /></div>}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Tab type ───────────────────────────────────────────────────────────────

type Tab = 'brief' | 'chat' | 'sessions'

// ─── Component ──────────────────────────────────────────────────────────────

export function TopicDetail({ topicId, authorName }: { topicId: string; authorName?: string }) {
  const [topic, setTopic] = useState<TopicData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<Tab>('brief')
  const [archiving, setArchiving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/topics/${topicId}`, { credentials: 'include' })
      if (!res.ok) throw new Error(await res.text())
      setTopic(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally { setLoading(false) }
  }, [topicId])

  useEffect(() => { load() }, [load])

  // Chat setup — uses topic's dedicated threadId
  const threadId = topic?.threadId ?? null

  const threadIdRef = useRef(threadId)
  threadIdRef.current = threadId

  const transport = useMemo(
    () => new DefaultChatTransport({
      body: () => ({ threadId: threadIdRef.current, topicId }),
    }),
    [topicId],
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    id: threadId ?? undefined,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  // Load existing messages for this topic thread
  const [chatLoaded, setChatLoaded] = useState(false)
  useEffect(() => {
    if (!threadId) return
    fetch(`/api/chat/history?threadId=${threadId}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          const msgs = await res.json()
          if (msgs.length > 0) {
            setMessages(msgs.map((m: any) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              parts: [{ type: 'text' as const, text: m.content }],
            })))
          }
        }
      })
      .catch(() => {})
      .finally(() => setChatLoaded(true))
  }, [threadId, setMessages])

  const [inputValue, setInputValue] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isLoading])

  const sendMessageRef = useRef(sendMessage)
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    setInputValue('')
    sendMessageRef.current({ text: trimmed })
  }, [isLoading])

  // Audio
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) return
        setTranscribing(true)
        try {
          const fd = new FormData(); fd.append('audio', blob)
          const res = await fetch('/api/chat/transcribe', { method: 'POST', body: fd })
          if (res.ok) { const { text } = await res.json(); if (text?.trim()) sendMessageRef.current({ text: text.trim() }) }
        } catch { /* */ } finally { setTranscribing(false) }
      }
      mr.start()
      setRecording(true)
    } catch { /* mic denied */ }
  }, [])

  const stopRecording = useCallback(() => { mediaRecorderRef.current?.stop(); setRecording(false) }, [])

  const [togglingStatus, setTogglingStatus] = useState(false)

  const handleToggleReady = useCallback(async () => {
    if (!topic) return
    setTogglingStatus(true)
    const newStatus = topic.status === 'READY' ? 'DRAFT' : 'READY'
    try {
      await fetch(`/api/topics/${topicId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      load()
    } catch { /* */ }
    finally { setTogglingStatus(false) }
  }, [topicId, topic, load])

  const handleArchive = useCallback(async () => {
    setArchiving(true)
    try {
      await fetch(`/api/topics/${topicId}`, { method: 'DELETE', credentials: 'include' })
      load()
    } catch { /* */ }
    finally { setArchiving(false) }
  }, [topicId, load])

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={22} className="animate-spin text-primary/40" />
      </div>
    )
  }

  if (error || !topic) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-sm text-red-400">{error || 'Sujet introuvable'}</p>
        <Link href="/topics" className="text-sm text-primary hover:text-primary/80">Retour aux sujets</Link>
      </div>
    )
  }

  const style = STATUS_STYLE[topic.status]

  // ─── Brief panel ────────────────────────────────────────────────────────

  const briefPanel = (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.class}`}>{style.label}</span>
          {topic.pillar && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/5 text-primary/70">{topic.pillar}</span>}
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{topic.name}</h1>
      </div>

      {/* Brief */}
      <div className="rounded-xl bg-muted/20 p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Brief</p>
        {topic.brief ? (
          <div className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none [&_p]:my-1 [&_strong]:text-foreground">
            <ReactMarkdown>{topic.brief}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Discute avec Kabou pour enrichir le brief de ce sujet.</p>
        )}
      </div>

      {/* Formats */}
      {(() => {
        const plannedFormats = topic.calendarEntries.map((e) => e.format).filter(Boolean)
        const recordedFormats = topic.sessions.map((s) => s.contentFormat).filter(Boolean) as string[]
        const allFormats = [...new Set([...plannedFormats, ...recordedFormats])]
        if (allFormats.length === 0) return null
        return (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Film size={12} /> Formats ({allFormats.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allFormats.map((f) => {
                const isRecorded = recordedFormats.includes(f)
                const isPlanned = plannedFormats.includes(f)
                const colorClass = FORMAT_COLORS[f] || 'bg-muted text-muted-foreground'
                return (
                  <span key={f} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${colorClass}`}>
                    {FORMAT_LABELS[f] || f}
                    {isRecorded && <CheckCircle2 size={10} className="opacity-60" />}
                    {!isRecorded && isPlanned && <Clock size={10} className="opacity-60" />}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Calendar entries */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <CalendarDays size={12} /> Planifications ({topic.calendarEntries.length})
        </p>
        {topic.calendarEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 pl-5">Aucune planification</p>
        ) : (
          topic.calendarEntries.map((e) => {
            const d = new Date(e.scheduledDate)
            const now = new Date()
            const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            const dateLabel = diffDays === 0 ? "Aujourd'hui" : diffDays === 1 ? 'Demain' : diffDays > 1 && diffDays < 7 ? `Dans ${diffDays}j` : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
            const isPast = diffDays < 0
            return (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/10 text-sm">
                <CalendarDays size={12} className={isPast ? 'text-muted-foreground/30' : 'text-primary/50'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${isPast ? 'text-muted-foreground/50' : 'text-foreground'}`}>{dateLabel}</span>
                    <span className="text-xs text-muted-foreground/50">{FORMAT_LABELS[e.format] || e.format}</span>
                  </div>
                  {e.topic && <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.topic}</p>}
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${e.status === 'PLANNED' ? 'bg-amber-500/10 text-amber-500' : e.status === 'RECORDED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                  {e.status === 'PLANNED' ? 'Planifie' : e.status === 'RECORDED' ? 'Enregistre' : e.status}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Sessions */}
      <SessionsList sessions={topic.sessions} />

      {/* LinkedIn posts generated from this topic */}
      <LinkedInPostsSection
        endpoint={`/api/topics/${topicId}/linkedin-posts`}
        authorName={authorName ?? topic.name}
        authorTitle={topic.pillar ?? undefined}
        generateLabel="Générer 3 posts depuis ce sujet"
        disabled={topic.status !== 'READY'}
        disabledReason={
          topic.status === 'ARCHIVED'
            ? 'Sujet archivé — impossible de générer des posts.'
            : 'Marque ton sujet comme « Prêt » pour débloquer la génération de posts LinkedIn.'
        }
      />

      {/* Actions */}
      {(() => {
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        const plannedEntries = topic.calendarEntries.filter((e) => e.status === 'PLANNED')
        const nearestPlanned = plannedEntries.length > 0
          ? plannedEntries.reduce((a, b) => new Date(a.scheduledDate) < new Date(b.scheduledDate) ? a : b)
          : null
        const nearestDate = nearestPlanned ? new Date(nearestPlanned.scheduledDate) : null
        if (nearestDate) nearestDate.setHours(0, 0, 0, 0)
        const canRecord = !nearestDate || nearestDate <= now
        const nearestLabel = nearestDate
          ? nearestDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
          : null

        return (
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {topic.status === 'DRAFT' && (
          <button
            onClick={handleToggleReady}
            disabled={togglingStatus}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-600/90 transition-colors disabled:opacity-40"
          >
            {togglingStatus ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Marquer comme pret
          </button>
        )}
        {topic.status === 'READY' && (
          <>
            {canRecord ? (
              <button
                onClick={() => {
                  sendMessageRef.current({ text: `Je veux enregistrer la video "${topic.name}". Prepare les questions et cree la session d'enregistrement.` })
                  setMobileTab('chat')
                }}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                <Play size={14} /> Lancer un enregistrement
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                <CalendarDays size={14} />
                <span>Prevu le <span className="font-medium text-foreground">{nearestLabel}</span></span>
              </div>
            )}
            <button
              onClick={handleToggleReady}
              disabled={togglingStatus}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
            >
              {togglingStatus ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
              Repasser en brouillon
            </button>
          </>
        )}
        {topic.status !== 'ARCHIVED' && (
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-40"
          >
            <Archive size={12} /> Archiver
          </button>
        )}
      </div>
        )
      })()}
    </div>
  )

  // ─── Chat panel ─────────────────────────────────────────────────────────

  const chatPanel = (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4 scrollbar-hide">
        {!chatLoaded && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-primary/40" />
          </div>
        )}
        {chatLoaded && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full overflow-hidden mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Discutons de &quot;{topic.name}&quot; pour affiner l&apos;angle et preparer ton contenu.
            </p>
          </div>
        )}
        {messages.map((message) => {
          const isUser = message.role === 'user'
          return (
            <div key={message.id}>
              {message.parts.map((part, idx) => {
                if (part.type === 'text' && part.text) {
                  return (
                    <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start gap-2'}`}>
                      {!isUser && (
                        <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mt-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${isUser ? 'bg-primary text-primary-foreground rounded-br-md' : 'text-foreground/80'}`}>
                        {isUser ? <p className="whitespace-pre-wrap">{part.text}</p> : (
                          <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground [&_a]:text-primary">
                            <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>, p: ({ children }) => { if (typeof children === 'string') { const parts = children.split(/(https?:\/\/[^\s]+)/g); if (parts.length > 1) return <p>{parts.map((p, i) => /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{p}</a> : p)}</p>; } return <p>{children}</p> } }}>{part.text}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }
                if (part.type === 'tool-invocation') {
                  const toolPart = part as unknown as { toolInvocation: { toolName: string; state: string; result?: Record<string, unknown> } }
                  const inv = toolPart.toolInvocation
                  if (inv.toolName === 'update_topic_brief' && inv.state === 'result') {
                    return (
                      <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-xs text-emerald-600">
                        <RefreshCw size={11} /> Brief mis a jour
                        <button onClick={load} className="ml-auto text-emerald-500 hover:text-emerald-600 underline">Voir</button>
                      </div>
                    )
                  }
                  if (inv.state === 'result' && inv.result?.topicUrl) {
                    return (
                      <Link key={idx} href={inv.result.topicUrl as string} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
                        <FileText size={14} /> Voir le sujet : {String(inv.result.name ?? '')}
                        <ArrowRight size={12} className="ml-auto" />
                      </Link>
                    )
                  }
                  if (inv.state !== 'result') {
                    return (
                      <div key={idx} className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <Loader2 size={11} className="animate-spin" /> {inv.toolName === 'update_topic_brief' ? 'Mise a jour du brief...' : 'Traitement...'}
                      </div>
                    )
                  }
                }
                return null
              })}
            </div>
          )
        })}
        {status === 'submitted' && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
            </div>
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span>Reflexion...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 py-2">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(inputValue) }} className="flex items-center gap-2">
          {transcribing ? (
            <div className="shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center"><Loader size={14} className="text-primary animate-spin" /></div>
          ) : recording ? (
            <button type="button" onClick={stopRecording} className="shrink-0 w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors animate-pulse"><Square size={12} /></button>
          ) : (
            <button type="button" onClick={startRecording} disabled={isLoading} className="shrink-0 w-9 h-9 rounded-full bg-surface-raised text-muted-foreground flex items-center justify-center hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"><Mic size={14} /></button>
          )}
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Discuter de ce sujet..."
            disabled={isLoading || recording}
            className="flex-1 rounded-full bg-surface border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors disabled:opacity-50"
          />
          <button type="submit" disabled={isLoading || !inputValue.trim()} className="shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-30 transition-colors">
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  )

  // ─── Layout ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Back link */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-2">
        <Link href="/topics" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} /> Sujets
        </Link>
      </div>

      {/* Desktop: side by side */}
      <div className="hidden md:flex flex-1 min-h-0">
        <div className="w-[440px] shrink-0 border-r border-border/40 overflow-y-auto px-6 py-4 scrollbar-hide">
          {briefPanel}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          {chatPanel}
        </div>
      </div>

      {/* Mobile: tabs */}
      <div className="md:hidden flex flex-col flex-1 min-h-0">
        <div className="flex gap-1 p-1 bg-surface rounded-xl w-fit mx-4">
          {([['brief', 'Brief'], ['chat', 'Discussion'], ['sessions', 'Sessions']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMobileTab(key)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                mobileTab === key ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {mobileTab === 'brief' && briefPanel}
          {mobileTab === 'chat' && chatPanel}
          {mobileTab === 'sessions' && (
            <SessionsList sessions={topic.sessions} />
          )}
        </div>
      </div>
    </div>
  )
}
