'use client'

import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls, DefaultChatTransport } from 'ai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Send, CalendarDays, Sparkles, RefreshCw, Pencil, ArrowRight, RotateCcw, Mic, Square, Loader2 as Loader, MessageSquare, Trash2, PanelLeftClose, PanelLeft, Plus, ChevronLeft, Menu, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Mon calendrier', icon: CalendarDays },
  { label: 'Modifier un sujet', icon: Pencil },
  { label: 'Regenerer le calendrier', icon: RefreshCw },
  { label: 'Idees de contenu', icon: Sparkles },
]

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  create_recording_session: { label: 'Creation de la session', icon: '🎬' },
  set_editorial_line: { label: 'Definition de la ligne editoriale', icon: '📋' },
  generate_calendar: { label: 'Generation du calendrier', icon: '📅' },
  regenerate_calendar: { label: 'Regeneration du calendrier', icon: '🔄' },
  update_calendar_entry: { label: 'Modification du calendrier', icon: '✏️' },
  update_profile: { label: 'Mise a jour du profil', icon: '👤' },
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Thread {
  threadId: string
  preview: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
      <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span>Reflexion...</span>
    </div>
  )
}

function ToolCallingCard({ toolName, args, state }: { toolName: string; args?: Record<string, unknown>; state: string }) {
  const meta = TOOL_LABELS[toolName] ?? { label: toolName, icon: '⚙️' }
  const title = args?.title as string | undefined
  return (
    <div className="rounded-xl bg-primary/5 p-4 my-2 space-y-2 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <span className="text-base">{meta.icon}</span>
        <span className="text-sm font-medium text-foreground">{meta.label}</span>
        <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin ml-auto" />
      </div>
      {title && <p className="text-xs text-muted-foreground pl-7">{title}</p>}
      {state === 'call' && args && (
        <div className="pl-7 flex flex-wrap gap-1.5">
          {typeof args.format === 'string' && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{args.format.replace(/_/g, ' ')}</span>}
          {typeof args.platform === 'string' && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{args.platform}</span>}
          {Array.isArray(args.pillars) && (args.pillars as string[]).map((p, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p}</span>)}
        </div>
      )}
    </div>
  )
}

function ToolResultCard({ toolName, result }: { toolName: string; result: Record<string, unknown> }) {
  if (!result?.success) {
    return (
      <div className="rounded-lg bg-destructive/5 p-4 my-2">
        <p className="text-sm text-destructive">Erreur : {(result?.error as string) ?? 'Echec'}</p>
      </div>
    )
  }
  if (toolName === 'set_editorial_line') {
    const pillars = result.pillars as string[] | undefined
    return (
      <div className="rounded-xl bg-primary/5 p-4 my-2 space-y-3">
        <div className="flex items-center gap-2"><Sparkles size={16} className="text-primary" /><span className="text-sm font-medium text-foreground">Ligne editoriale definie</span></div>
        {pillars && pillars.length > 0 && <div className="flex flex-wrap gap-1.5">{pillars.map((p, i) => <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">{p}</span>)}</div>}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {result.tone ? <span>Ton : <span className="text-foreground">{String(result.tone)}</span></span> : null}
          {result.frequency != null ? <span>Frequence : <span className="text-foreground">{String(result.frequency)}/sem</span></span> : null}
        </div>
      </div>
    )
  }
  if (toolName === 'generate_calendar' || toolName === 'regenerate_calendar') {
    return (
      <div className="rounded-xl bg-primary/5 p-4 my-2 space-y-3">
        <div className="flex items-center gap-2"><CalendarDays size={16} className="text-primary" /><span className="text-sm font-medium text-foreground">{toolName === 'regenerate_calendar' ? 'Calendrier regenere' : 'Calendrier genere'}</span></div>
        {result.count != null && <p className="text-xs text-muted-foreground">{result.count as number} videos planifiees</p>}
        <a href="/calendar" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Voir le calendrier <ArrowRight size={12} /></a>
      </div>
    )
  }
  if (toolName === 'update_calendar_entry') {
    const entry = result.entry as Record<string, unknown> | undefined
    return (
      <div className="rounded-xl bg-primary/5 p-4 my-2 space-y-2">
        <div className="flex items-center gap-2"><Pencil size={16} className="text-primary" /><span className="text-sm font-medium text-foreground">Sujet modifie</span></div>
        {entry && <p className="text-sm text-foreground">{entry.topic as string}</p>}
      </div>
    )
  }
  if (toolName === 'update_profile') {
    return (<div className="rounded-xl bg-primary/5 p-4 my-2"><div className="flex items-center gap-2"><Sparkles size={16} className="text-primary" /><span className="text-sm font-medium text-foreground">Profil mis a jour</span></div></div>)
  }
  if (toolName === 'create_recording_session') {
    const shareLink = result.shareLink as string | undefined
    const format = result.format as string | undefined
    const questionsCount = result.questionsCount as number | undefined
    return (
      <div className="rounded-xl bg-primary/5 p-5 my-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"><ArrowRight size={16} className="text-primary" /></div>
          <div><span className="text-sm font-medium text-foreground block">Session prete !</span><span className="text-xs text-muted-foreground">{format ? String(format).replace(/_/g, ' ') : ''} {questionsCount ? `· ${questionsCount} questions` : ''}</span></div>
        </div>
        <p className="text-sm text-foreground font-medium">{String(result.title ?? '')}</p>
        {shareLink && <a href={shareLink} className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full justify-center">Lancer l&apos;enregistrement <ArrowRight size={14} /></a>}
      </div>
    )
  }
  return null
}

// ─── Thread Sidebar ──────────────────────────────────────────────────────────

function ChatSidebar({ threads, activeThreadId, onSelect, onNew, onDelete, open, onToggle, loading }: {
  threads: Thread[]
  activeThreadId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  open: boolean
  onToggle: () => void
  loading: boolean
}) {
  function formatDate(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return "Aujourd'hui"
    if (days === 1) return 'Hier'
    if (days < 7) return `Il y a ${days}j`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <>
      {/* Toggle button when closed */}
      {!open && (
        <button
          onClick={onToggle}
          className="absolute top-3 left-3 z-20 w-9 h-9 rounded-lg bg-surface-raised hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors md:flex hidden"
        >
          <PanelLeft size={18} />
        </button>
      )}

      {/* Sidebar panel */}
      <div className={`${open ? 'w-[260px]' : 'w-0'} shrink-0 transition-all duration-200 overflow-hidden border-r border-border/40 bg-surface/30 hidden md:block`}>
        <div className="w-[260px] h-full flex flex-col">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-3 shrink-0">
            <button onClick={onNew} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
              <Plus size={16} /> Nouveau
            </button>
            <button onClick={onToggle} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <PanelLeftClose size={16} />
            </button>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 custom-scrollbar">
            {loading && (
              <div className="space-y-1 px-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-lg px-3 py-3 space-y-2">
                    <div className="h-3.5 bg-muted animate-pulse rounded-md w-[85%]" style={{ animationDelay: `${i * 100}ms` }} />
                    <div className="h-2.5 bg-muted/60 animate-pulse rounded-md w-[50%]" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                  </div>
                ))}
              </div>
            )}
            {!loading && threads.length === 0 && (
              <div className="px-3 py-8 text-center">
                <MessageSquare size={20} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground/50">Aucune conversation</p>
              </div>
            )}
            {!loading && threads.map((t, i) => {
              const isActive = activeThreadId === t.threadId
              const isLatest = i === 0
              return (
              <div
                key={t.threadId}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  isActive ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                }`}
                onClick={() => onSelect(t.threadId)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm truncate ${!isLatest ? 'text-muted-foreground/70' : ''}`}>{t.preview}</p>
                    {isLatest && <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">active</span>}
                  </div>
                  <p className="text-xs text-muted-foreground/50 mt-0.5">{formatDate(t.updatedAt)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(t.threadId) }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md hover:bg-red-500/10 hover:text-red-400 flex items-center justify-center transition-all shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main ChatPage ───────────────────────────────────────────────────────────

export function ChatPage() {
  const searchParams = useSearchParams()

  // Thread state
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const activeThreadIdRef = useRef(activeThreadId)
  activeThreadIdRef.current = activeThreadId

  const transport = useMemo(
    () => new DefaultChatTransport({ body: () => ({ threadId: activeThreadIdRef.current }) }),
    [], // stable — reads activeThreadId from ref at call time
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    id: activeThreadId ?? undefined,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  })

  const [threadsLoading, setThreadsLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)

  // Load thread list
  const loadThreads = useCallback(async (silent = false) => {
    if (!silent) setThreadsLoading(true)
    try {
      const res = await fetch('/api/chat/history', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setThreads(data)
        return data as Thread[]
      }
    } catch { /* */ }
    finally { setThreadsLoading(false) }
    return []
  }, [])

  // Load messages for a thread
  const loadThread = useCallback(async (threadId: string) => {
    setThreadLoading(true)
    try {
      const res = await fetch(`/api/chat/history?threadId=${threadId}`, { credentials: 'include' })
      if (res.ok) {
        const msgs = await res.json()
        setMessages(msgs.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          parts: [{ type: 'text' as const, text: m.content }],
        })))
      }
    } catch { /* */ }
    finally { setThreadLoading(false) }
  }, [setMessages])

  // Initial load
  useEffect(() => {
    loadThreads().then((threadList) => {
      if (threadList.length > 0) {
        const latest = threadList[0]
        setActiveThreadId(latest.threadId)
        loadThread(latest.threadId)
      }
      setHistoryLoaded(true)
    })
  }, [loadThreads, loadThread])

  // Switch thread
  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    loadThread(threadId)
  }, [loadThread])

  // New conversation
  const newConversation = useCallback(() => {
    const newId = crypto.randomUUID()
    setActiveThreadId(newId)
    setMessages([])
  }, [setMessages])

  // Delete thread with confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return
    await fetch(`/api/chat/history?threadId=${deleteConfirmId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {})
    setThreads((prev) => prev.filter((t) => t.threadId !== deleteConfirmId))
    if (activeThreadId === deleteConfirmId) {
      newConversation()
    }
    setDeleteConfirmId(null)
  }, [activeThreadId, newConversation])

  // Refresh thread list after each assistant reply
  const prevStatusRef = useRef(status)
  useEffect(() => {
    const wasActive = prevStatusRef.current === 'submitted' || prevStatusRef.current === 'streaming'
    prevStatusRef.current = status
    if (wasActive && status === 'ready' && messages.length > 0) {
      loadThreads(true).then((threadList) => {
        // Sync activeThreadId with the latest thread if current is new
        if (threadList.length > 0 && !threadList.find((t: Thread) => t.threadId === activeThreadId)) {
          setActiveThreadId(threadList[0].threadId)
        }
      })
    }
  }, [status, messages.length, loadThreads, activeThreadId])

  const [inputValue, setInputValue] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const isLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isLoading])

  useEffect(() => { inputRef.current?.focus() }, [activeThreadId])

  const showQuickActions = !isLoading && (messages.length === 0 || messages[messages.length - 1]?.role === 'assistant')

  const sendMessageRef = useRef(sendMessage)
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    setInputValue('')
    sendMessageRef.current({ text: trimmed })
  }, [isLoading])

  // ── Audio recording ──
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
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
      mediaRecorder.start()
      setRecording(true)
    } catch { /* mic denied */ }
  }, [])

  const stopRecording = useCallback(() => { mediaRecorderRef.current?.stop(); setRecording(false) }, [])

  // Auto-send from redirect
  const autoSendFired = useRef<string | null>(null)
  const topicParam = searchParams.get('topic')
  const actionParam = searchParams.get('action')
  useEffect(() => {
    if (!historyLoaded || !topicParam) return
    // Avoid re-firing for the same topic
    if (autoSendFired.current === topicParam) return
    autoSendFired.current = topicParam
    window.history.replaceState({}, '', '/chat')
    newConversation()

    let text: string
    if (actionParam === 'record') {
      const format = searchParams.get('format') ?? 'QUESTION_BOX'
      text = `Je veux enregistrer la video "${topicParam}" (format: ${format}). Cree directement la session d'enregistrement.`
    } else {
      text = `J'aimerais creer un contenu video sur ce sujet : "${topicParam}". Aide-moi a preparer les questions ou le script, puis on lance l'enregistrement.`
    }
    setTimeout(() => sendMessageRef.current({ text }), 100)
  }, [historyLoaded, topicParam, actionParam, newConversation, searchParams])

  const handleFormSubmit = (e: React.FormEvent) => { e.preventDefault(); handleSend(inputValue) }

  // A thread is archived if it's not the most recent one in the list
  const isViewingArchive = threads.length > 0 && activeThreadId !== null && threads[0]?.threadId !== activeThreadId && threads.some((t) => t.threadId === activeThreadId)

  // Mobile drawer
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Hide bottom nav on mobile for chat page
  useEffect(() => {
    const bottomNav = document.querySelector('[data-bottom-nav]')
    if (bottomNav) (bottomNav as HTMLElement).style.display = 'none'
    return () => { if (bottomNav) (bottomNav as HTMLElement).style.display = '' }
  }, [])

  return (
    <div className="flex h-full relative">
      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background rounded-2xl p-6 max-w-xs w-full mx-4 space-y-4 shadow-2xl">
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Supprimer la conversation ?</h3>
              <p className="text-sm text-muted-foreground">Cette action est irreversible.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-2.5 rounded-lg bg-muted/40 text-sm text-muted-foreground hover:text-foreground transition-colors">Annuler</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile thread drawer */}
      {mobileDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden" onClick={() => setMobileDrawerOpen(false)} />
          <div className="fixed top-0 left-0 h-full w-[280px] z-50 bg-background shadow-2xl flex flex-col md:hidden animate-in slide-in-from-left duration-200">
            <div className="h-14 flex items-center justify-between px-4 shrink-0">
              <button onClick={newConversation} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors">
                <Plus size={16} /> Nouveau
              </button>
              <button onClick={() => setMobileDrawerOpen(false)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
              {threads.map((t, i) => {
                const isLatest = i === 0
                return (
                  <div key={t.threadId}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${activeThreadId === t.threadId ? 'bg-surface-raised text-foreground' : 'text-muted-foreground'}`}
                    onClick={() => { selectThread(t.threadId); setMobileDrawerOpen(false) }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm truncate">{t.preview}</p>
                        {isLatest && <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">active</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <ChatSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelect={selectThread}
        onNew={newConversation}
        onDelete={setDeleteConfirmId}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        loading={threadsLoading}
      />

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="h-12 flex items-center justify-between px-3 shrink-0 md:hidden">
          <Link href="/home" className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <ChevronLeft size={20} />
          </Link>
          <span className="text-sm font-medium text-foreground">Kabou</span>
          <button onClick={() => setMobileDrawerOpen(true)} className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <Menu size={18} />
          </button>
        </div>
        <div className="flex flex-col h-full max-w-[700px] mx-auto w-full">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4 scrollbar-hide">
            {(threadLoading || (!historyLoaded && messages.length === 0)) && (
              <div className="space-y-4 py-4">
                <div className="flex justify-end"><div className="h-10 bg-primary/10 animate-pulse rounded-2xl rounded-br-md w-[60%]" /></div>
                <div className="flex justify-start"><div className="h-16 bg-muted animate-pulse rounded-2xl w-[75%]" /></div>
                <div className="flex justify-end"><div className="h-8 bg-primary/10 animate-pulse rounded-2xl rounded-br-md w-[45%]" /></div>
                <div className="flex justify-start"><div className="h-24 bg-muted animate-pulse rounded-2xl w-[70%]" /></div>
              </div>
            )}
            {messages.length === 0 && historyLoaded && !threadLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-14 h-14 rounded-full overflow-hidden mb-4 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-2">Kabou</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Salut ! Je suis Kabou, ton assistant pour creer du contenu video. Parle-moi de ton activite, je suis la pour t&apos;aider.
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
                            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'bg-primary text-primary-foreground rounded-br-md' : 'text-foreground/80'}`}>
                            {isUser ? <p className="whitespace-pre-wrap">{part.text}</p> : (
                              <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground [&_a]:text-primary">
                                <ReactMarkdown>{part.text}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }
                    if (part.type === 'tool-invocation') {
                      const toolPart = part as unknown as { toolInvocation: { toolName: string; state: string; args?: Record<string, unknown>; result?: Record<string, unknown> } }
                      const inv = toolPart.toolInvocation
                      if (inv.state === 'result' && inv.result) return <ToolResultCard key={idx} toolName={inv.toolName} result={inv.result} />
                      return <ToolCallingCard key={idx} toolName={inv.toolName} args={inv.args} state={inv.state} />
                    }
                    return null
                  })}
                </div>
              )
            })}

            {status === 'submitted' && (
              <div className="flex justify-start gap-2">
                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lavi-robot.png" alt="Kabou" className="w-full h-full object-cover" />
                </div>
                <TypingIndicator />
              </div>
            )}
          </div>

          {/* Quick actions + Input */}
          {isViewingArchive ? (
            <div className="shrink-0 bg-muted/20 px-4 py-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Conversation archivee — lecture seule</p>
              <button
                onClick={newConversation}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
              >
                <Plus size={14} /> Nouvelle conversation
              </button>
            </div>
          ) : (
          <div className="shrink-0 bg-background px-4 py-3 space-y-3">
            {showQuickActions && messages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon
                  return (
                    <button key={action.label} onClick={() => handleSend(action.label)} disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-50">
                      <Icon size={12} />{action.label}
                    </button>
                  )
                })}
              </div>
            )}

            <form ref={formRef} onSubmit={handleFormSubmit} className="flex items-center gap-2">
              {transcribing ? (
                <div className="shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Loader size={16} className="text-primary animate-spin" /></div>
              ) : recording ? (
                <button type="button" onClick={stopRecording} className="shrink-0 w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors animate-pulse"><Square size={14} /></button>
              ) : (
                <button type="button" onClick={startRecording} disabled={isLoading || transcribing} className="shrink-0 w-10 h-10 rounded-full bg-surface-raised text-muted-foreground flex items-center justify-center hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"><Mic size={16} /></button>
              )}
              <input ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                placeholder={recording ? 'Ecoute en cours...' : 'Ecris ton message...'} disabled={isLoading || recording || transcribing}
                className="flex-1 rounded-full bg-surface border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors disabled:opacity-50" />
              <button type="submit" disabled={isLoading || !inputValue.trim() || recording || transcribing}
                className="shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-30"><Send size={16} /></button>
            </form>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
